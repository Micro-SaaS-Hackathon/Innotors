"use client";

import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Transformer, Image as KonvaImage, Line, Path } from "react-konva";
import Konva from "konva";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const Canva = () => {
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [pagesData, setPagesData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [showColumnMapping, setShowColumnMapping] = useState(false); // New state for column mapping
  const [columnMapping, setColumnMapping] = useState({}); // Store column mappings

  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const stageWidth = window.innerWidth - (selectedId ? 300 : 0);
  const stageHeight = window.innerHeight - 70;

  // =========================
  // PDF Upload and Parsing
  // =========================
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.error("No file selected");
      setPdfUploaded(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/extract", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! Status: ${res.status}, Message: ${errorText}`);
      }
      const data = await res.json();
      setPagesData(data.pages);

      // Assume first page for simplicity
      const page = data.pages[0];
      setCanvasWidth(page.width);
      setCanvasHeight(page.height);

      const newShapes = [];
      let idCounter = 1;

      // Texts
      page.texts.forEach((t) => {
        if (t.text) {
          newShapes.push({
            id: `text${idCounter++}`,
            type: "text",
            name: t.text.slice(0, 20) || `Text_${idCounter}`,
            x: t.bbox[0],
            y: t.bbox[1],
            text: t.text,
            fontSize: t.size || 12,
            fill: t.fill || "#000",
            draggable: true,
            dataField: null,
            zIndex: idCounter,
          });
        }
      });

      // Images
      page.images.forEach((im) => {
        const img = new window.Image();
        img.src = im.image_url;
        newShapes.push({
          id: `image${idCounter++}`,
          type: "image",
          name: `Image_${idCounter}`,
          x: im.bbox[0],
          y: im.bbox[1],
          width: im.bbox[2] - im.bbox[0],
          height: im.bbox[3] - im.bbox[1],
          image: img,
          draggable: true,
          dataField: null,
          zIndex: idCounter,
        });
      });

      // Shapes (paths)
      page.shapes.forEach((sh) => {
        if (sh.path_data) {
          newShapes.push({
            id: `path${idCounter++}`,
            type: "path",
            name: `Path_${idCounter}`,
            x: 0,
            y: 0,
            data: sh.path_data,
            fill: sh.fill,
            stroke: sh.stroke,
            strokeWidth: sh.strokeWidth || 1,
            draggable: true,
            dataField: null,
            zIndex: idCounter,
          });
        }
      });

      // Sort by z-index
      newShapes.sort((a, b) => a.zIndex - b.zIndex);
      setShapes(newShapes);
      setPdfUploaded(true);
    } catch (error) {
      console.error("Fetch error:", error.message);
      setPdfUploaded(false);
    }
  };

  // =========================
  // Excel Upload and Parsing
  // =========================
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      setColumns(jsonData[0] || []);
      setRows(jsonData.slice(1));
      setShowColumnMapping(true); // Show column mapping interface
    };
    reader.readAsArrayBuffer(file);
  };

  // =========================
  // Column Mapping
  // =========================
  const handleMappingChange = (shapeId, columnName) => {
    setColumnMapping(prev => ({
      ...prev,
      [shapeId]: columnName
    }));
  };

  const saveColumnMapping = () => {
    // Apply mappings to shapes
    setShapes(prev => prev.map(shape => ({
      ...shape,
      dataField: columnMapping[shape.id] || null
    })));
    setShowColumnMapping(false);
  };

  // =========================
  // Generate PNGs
  // =========================
  const cloneShapes = (shapes) => {
    return shapes.map((shape) => {
      const cloned = { ...shape };
      if (shape.image) {
        const img = new window.Image();
        img.src = shape.image.src;
        cloned.image = img;
      }
      return cloned;
    });
  };

  const handleGenerate = async () => {
    if (rows.length === 0) {
      alert("Please upload an Excel file first.");
      return;
    }

    const dataURLs = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tempShapes = cloneShapes(shapes);
      const promises = [];

      tempShapes.forEach((shape) => {
        if (shape.dataField) {
          const colIndex = columns.indexOf(shape.dataField);
          if (colIndex !== -1) {
            const value = row[colIndex];
            if (shape.type === "text") {
              shape.text = value ? value.toString() : "";
            } else if (shape.type === "image" && value) {
              promises.push(
                new Promise((resolve, reject) => {
                  const img = new window.Image();
                  img.onload = () => {
                    shape.image = img;
                    resolve();
                  };
                  img.onerror = reject;
                  img.src = value;
                })
              );
            }
          }
        }
      });

      await Promise.all(promises);

      // Create offscreen Konva stage
      const div = document.createElement("div");
      document.body.appendChild(div);
      const offStage = new Konva.Stage({
        container: div,
        width: canvasWidth,
        height: canvasHeight,
      });
      const layer = new Konva.Layer();
      offStage.add(layer);

      // Sort shapes by z-index before rendering
      const sortedShapes = [...tempShapes].sort((a, b) => a.zIndex - b.zIndex);

      sortedShapes.forEach((shape) => {
        let node;
        switch (shape.type) {
          case "rect":
            node = new Konva.Rect(shape);
            break;
          case "text":
            node = new Konva.Text(shape);
            break;
          case "image":
            node = new Konva.Image(shape);
            break;
          case "path":
            node = new Konva.Path({
              x: shape.x,
              y: shape.y,
            data: shape.data,
              fill: shape.fill,
              stroke: shape.stroke,
              strokeWidth: shape.strokeWidth,
            });
            break;
          default:
            break;
        }
        if (node) layer.add(node);
      });

      layer.draw();
      const dataURL = offStage.toDataURL({ mimeType: "image/png", pixelRatio: 2 });
      dataURLs.push(dataURL);
      offStage.destroy();
      document.body.removeChild(div);
    }

    // Zip and download
    const zip = new JSZip();
    dataURLs.forEach((url, i) => {
      const base64Data = url.split(",")[1];
      zip.file(`design_${i + 1}.png`, base64Data, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "designs.zip");
  };

  // =========================
  // Shape Selection & Transformer
  // =========================
  const handleSelect = (e) => {
    e.evt.stopPropagation();
    const id = e.target.id();
    setSelectedId(id);
  };

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      const selectedShape = shapes.find((s) => s.id === selectedId);
      if (node && selectedShape.type !== "path") {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer().batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedId, shapes]);

  const handleStageMouseDown = (e) => {
    if (e.target === stageRef.current) {
      setSelectedId(null);
    }
  };

  // =========================
  // Zoom and Drag Functionality
  // =========================
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = scale;
    const newScale = e.evt.deltaY < 0 ? scale * scaleBy : scale / scaleBy;
    const boundedScale = Math.min(Math.max(0.5, newScale), 3);

    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * boundedScale,
      y: pointer.y - mousePointTo.y * boundedScale,
    };

    setScale(boundedScale);
    setStagePos(newPos);
  };

  const handleStageDragStart = (e) => {
    // Allow stage drag only when clicking on empty space
    if (selectedId) {
      e.evt.stopPropagation();
      e.cancelBubble = true;
    }
  };

  const handleStageDragEnd = (e) => {
    setStagePos({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  // =========================
  // Shape Drag Handlers
  // =========================
  const handleShapeDragStart = (e) => {
    e.evt.stopPropagation();
  };

  const handleShapeDragEnd = (e) => {
    e.evt.stopPropagation();
    setShapes((prev) =>
      prev.map((s) =>
        s.id === e.target.id() ? { ...s, x: e.target.x(), y: e.target.y() } : s
      )
    );
  };

  // =========================
  // Adding Shapes (manual)
  // =========================
  const addRectangle = () => {
    const newShape = {
      id: `rect${shapes.length + 1}`,
      type: "rect",
      name: `Rectangle_${shapes.length + 1}`,
      x: 50,
      y: 50,
      width: 120,
      height: 100,
      fill: "#ff4d4f",
      draggable: true,
      dataField: null,
      zIndex: shapes.length + 1,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);
  };

  const addText = () => {
    const newShape = {
      id: `text${shapes.length + 1}`,
      type: "text",
      name: `Text_${shapes.length + 1}`,
      x: 60,
      y: 60,
      text: "Text",
      fontSize: 22,
      fill: "#333",
      draggable: true,
      dataField: null,
      zIndex: shapes.length + 1,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);
  };

  const addImage = () => fileInputRef.current.click();

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const newShape = {
          id: `image${shapes.length + 1}`,
          type: "image",
          name: `Image_${shapes.length + 1}`,
          x: 50,
          y: 50,
          width: 120,
          height: 120,
          image: img,
          draggable: true,
          dataField: null,
          zIndex: shapes.length + 1,
        };
        setShapes((prev) => [...prev, newShape]);
        setSelectedId(newShape.id);
      };
    };
    reader.readAsDataURL(file);
  };

  // =========================
  // Update Shape Properties
  // =========================
  const updateShapeProperty = (property, value) => {
    setShapes((prev) =>
      prev.map((shape) =>
        shape.id === selectedId
          ? {
              ...shape,
              [property]:
                property === "width" || property === "height" || property === "fontSize" || property === "strokeWidth"
                  ? Math.max(0.1, parseFloat(value) || 0.1)
                  : property === "dataField"
                  ? value || null
                  : value,
            }
          : shape
      )
    );
  };

  // =========================
  // Z-Index Management
  // =========================
  const moveToFront = () => {
    setShapes(prev => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex(s => s.id === selectedId);
      if (selectedIndex !== -1) {
        const [movedShape] = newShapes.splice(selectedIndex, 1);
        newShapes.push({...movedShape, zIndex: newShapes.length + 1});
        return newShapes;
      }
      return prev;
    });
  };

  const moveToBack = () => {
    setShapes(prev => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex(s => s.id === selectedId);
      if (selectedIndex !== -1) {
        const [movedShape] = newShapes.splice(selectedIndex, 1);
        newShapes.unshift({...movedShape, zIndex: 0});
        // Reassign z-indices
        return newShapes.map((shape, index) => ({
          ...shape,
          zIndex: index
        }));
      }
      return prev;
    });
  };

  const moveUp = () => {
    setShapes(prev => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex(s => s.id === selectedId);
      if (selectedIndex > 0) {
        [newShapes[selectedIndex - 1], newShapes[selectedIndex]] = 
        [newShapes[selectedIndex], newShapes[selectedIndex - 1]];
        // Reassign z-indices
        return newShapes.map((shape, index) => ({
          ...shape,
          zIndex: index
        }));
      }
      return prev;
    });
  };

  const moveDown = () => {
    setShapes(prev => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex(s => s.id === selectedId);
      if (selectedIndex < newShapes.length - 1) {
        [newShapes[selectedIndex], newShapes[selectedIndex + 1]] = 
        [newShapes[selectedIndex + 1], newShapes[selectedIndex]];
        // Reassign z-indices
        return newShapes.map((shape, index) => ({
          ...shape,
          zIndex: index
        }));
      }
      return prev;
    });
  };

  const selectedShape = shapes.find((shape) => shape.id === selectedId);

  // =========================
  // Render
  // =========================
  if (!pdfUploaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Upload PDF Template</h1>
          <input
            type="file"
            accept=".pdf"
            ref={pdfInputRef}
            className="hidden"
            onChange={handlePdfUpload}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
            onClick={() => pdfInputRef.current.click()}
          >
            Upload PDF
          </button>
        </div>
      </div>
    );
  }

  // Column Mapping Interface
  if (showColumnMapping) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 p-8">
          <h1 className="text-2xl font-bold mb-6">Map Excel Columns to Objects</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Excel Columns</h2>
                <ul className="space-y-2">
                  {columns.map((col, index) => (
                    <li key={index} className="p-3 bg-gray-100 rounded">
                      {col}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">Canvas Objects</h2>
                <div className="space-y-4">
                  {shapes.map((shape) => (
                    <div key={shape.id} className="p-3 bg-white border rounded">
                      <div className="font-medium">{shape.name}</div>
                      <div className="mt-2">
                        <label className="block text-sm text-gray-600 mb-1">Map to column:</label>
                        <select
                          value={columnMapping[shape.id] || ""}
                          onChange={(e) => handleMappingChange(shape.id, e.target.value)}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">Select column</option>
                          {columns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
                onClick={saveColumnMapping}
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="p-3 bg-white shadow flex gap-3 items-center flex-wrap">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
            onClick={addRectangle}
          >
            Rectangle
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
            onClick={addText}
          >
            Text
          </button>
          <button
            className="px-4 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 transition"
            onClick={addImage}
          >
            Image
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg shadow hover:bg-yellow-700 transition"
            onClick={() => excelInputRef.current.click()}
          >
            Upload Excel
          </button>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={excelInputRef}
            className="hidden"
            onChange={handleExcelUpload}
          />
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition"
            onClick={handleGenerate}
          >
            Generate PNGs
          </button>
          <div className="ml-auto flex gap-2 flex-wrap">
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition"
              onClick={() => {
                const stage = stageRef.current;
                const pointer = stage.getPointerPosition();
                const mousePointTo = {
                  x: (pointer.x - stagePos.x) / scale,
                  y: (pointer.y - stagePos.y) / scale,
                };
                const newScale = Math.min(3, scale * 1.1);
                const newPos = {
                  x: pointer.x - mousePointTo.x * newScale,
                  y: pointer.y - mousePointTo.y * newScale,
                };
                setScale(newScale);
                setStagePos(newPos);
              }}
            >
              Zoom In
            </button>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition"
              onClick={() => {
                const stage = stageRef.current;
                const pointer = stage.getPointerPosition();
                const mousePointTo = {
                  x: (pointer.x - stagePos.x) / scale,
                  y: (pointer.y - stagePos.y) / scale,
                };
                const newScale = Math.max(0.5, scale / 1.1);
                const newPos = {
                  x: pointer.x - mousePointTo.x * newScale,
                  y: pointer.y - mousePointTo.y * newScale,
                };
                setScale(newScale);
                setStagePos(newPos);
              }}
            >
              Zoom Out
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <Stage
            width={stageWidth}
            height={stageHeight}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={true}
            onDragStart={handleStageDragStart}
            onDragEnd={handleStageDragEnd}
            ref={stageRef}
            onMouseDown={handleStageMouseDown}
            onWheel={handleWheel}
            style={{ backgroundColor: "#e5e7eb" }}
          >
            <Layer>
              {/* Canvas Background */}
              <Rect
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fill="#f9fafb"
                stroke="#000"
                strokeWidth={1 / scale}
                listening={false}
              />

              {/* Grid */}
              {Array.from({ length: Math.ceil(canvasWidth / 50) }).map((_, i) => (
                <Line
                  key={`v${i}`}
                  points={[i * 50, 0, i * 50, canvasHeight]}
                  stroke="#eee"
                  strokeWidth={1 / scale}
                  listening={false}
                />
              ))}
              {Array.from({ length: Math.ceil(canvasHeight / 50) }).map((_, i) => (
                <Line
                  key={`h${i}`}
                  points={[0, i * 50, canvasWidth, i * 50]}
                  stroke="#eee"
                  strokeWidth={1 / scale}
                  listening={false}
                />
              ))}

              {/* Shapes - sorted by z-index */}
              {[...shapes]
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((shape) => {
                  if (shape.type === "rect")
                    return (
                      <Rect
                        key={shape.id}
                        id={shape.id}
                        {...shape}
                        onClick={handleSelect}
                        onMouseDown={handleSelect}
                        onDragStart={handleShapeDragStart}
                        onDragEnd={handleShapeDragEnd}
                        onTransformEnd={(e) => {
                          e.evt.stopPropagation();
                          const node = e.target;
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? {
                                    ...s,
                                    x: node.x(),
                                    y: node.y(),
                                    width: Math.max(10, node.width() * node.scaleX()),
                                    height: Math.max(10, node.height() * node.scaleY()),
                                  }
                                : s
                            )
                          );
                          node.scaleX(1);
                          node.scaleY(1);
                        }}
                      />
                    );
                  else if (shape.type === "text")
                    return (
                      <Text
                        key={shape.id}
                        id={shape.id}
                        {...shape}
                        onClick={handleSelect}
                        onMouseDown={handleSelect}
                        onDragStart={handleShapeDragStart}
                        onDragEnd={handleShapeDragEnd}
                        onTransformEnd={(e) => {
                          e.evt.stopPropagation();
                          const node = e.target;
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? {
                                    ...s,
                                    x: node.x(),
                                    y: node.y(),
                                    fontSize: Math.max(10, node.fontSize() * node.scaleX()),
                                  }
                                : s
                            )
                          );
                          node.scaleX(1);
                          node.scaleY(1);
                        }}
                      />
                    );
                  else if (shape.type === "image")
                    return (
                      <KonvaImage
                        key={shape.id}
                        id={shape.id}
                        {...shape}
                        onClick={handleSelect}
                        onMouseDown={handleSelect}
                        onDragStart={handleShapeDragStart}
                        onDragEnd={handleShapeDragEnd}
                        onTransformEnd={(e) => {
                          e.evt.stopPropagation();
                          const node = e.target;
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? {
                                    ...s,
                                    x: node.x(),
                                    y: node.y(),
                                    width: Math.max(10, node.width() * node.scaleX()),
                                    height: Math.max(10, node.height() * node.scaleY()),
                                  }
                                : s
                            )
                          );
                          node.scaleX(1);
                          node.scaleY(1);
                        }}
                      />
                    );
                  else if (shape.type === "path")
                    return (
                      <Path
                        key={shape.id}
                        id={shape.id}
                        x={shape.x}
                        y={shape.y}
                        data={shape.data}
                        fill={shape.fill}
                        stroke={shape.stroke}
                        strokeWidth={shape.strokeWidth}
                        onClick={handleSelect}
                        onMouseDown={handleSelect}
                        draggable={shape.draggable}
                        onDragStart={handleShapeDragStart}
                        onDragEnd={handleShapeDragEnd}
                      />
                    );
                  return null;
                })}
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => ({
                  ...newBox,
                  width: Math.max(10, newBox.width),
                  height: Math.max(10, newBox.height),
                })}
              />
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Side Panel */}
      <div
        className={`w-72 bg-white p-5 border-l shadow-lg transition-all ${
          selectedId ? "block" : "hidden"
        }`}
      >
        {selectedShape && (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">Edit Properties</h2>
            
            {/* Z-Index Controls */}
            <div className="border-b pb-3">
              <label className="block text-gray-600 mb-2">Z-Index</label>
              <div className="flex gap-2">
                <button 
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={moveToFront}
                >
                  To Front
                </button>
                <button 
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={moveToBack}
                >
                  To Back
                </button>
                <button 
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={moveUp}
                >
                  Up
                </button>
                <button 
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={moveDown}
                >
                  Down
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={selectedShape.name}
                onChange={(e) => updateShapeProperty("name", e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            {selectedShape.type === "rect" && (
              <>
                <div>
                  <label className="block text-gray-600 mb-1">Fill Color</label>
                  <input
                    type="color"
                    value={selectedShape.fill}
                    onChange={(e) => updateShapeProperty("fill", e.target.value)}
                    className="w-full h-10 rounded-lg border"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Width</label>
                  <input
                    type="number"
                    value={selectedShape.width}
                    onChange={(e) => updateShapeProperty("width", parseInt(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedShape.height}
                    onChange={(e) => updateShapeProperty("height", parseInt(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </>
            )}

            {selectedShape.type === "text" && (
              <>
                <div>
                  <label className="block text-gray-600 mb-1">Text</label>
                  <input
                    type="text"
                    value={selectedShape.text}
                    onChange={(e) => updateShapeProperty("text", e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Font Size</label>
                  <input
                    type="number"
                    value={selectedShape.fontSize}
                    onChange={(e) => updateShapeProperty("fontSize", parseInt(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Fill Color</label>
                  <input
                    type="color"
                    value={selectedShape.fill}
                    onChange={(e) => updateShapeProperty("fill", e.target.value)}
                    className="w-full h-10 rounded-lg border"
                  />
                </div>
              </>
            )}

            {selectedShape.type === "image" && (
              <>
                <div>
                  <label className="block text-gray-600 mb-1">Width</label>
                  <input
                    type="number"
                    value={selectedShape.width}
                    onChange={(e) => updateShapeProperty("width", parseInt(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedShape.height}
                    onChange={(e) => updateShapeProperty("height", parseInt(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </>
            )}

            {selectedShape.type === "path" && (
              <>
                <div>
                  <label className="block text-gray-600 mb-1">Fill Color</label>
                  <input
                    type="color"
                    value={selectedShape.fill || "#000000"}
                    onChange={(e) => updateShapeProperty("fill", e.target.value || null)}
                    className="w-full h-10 rounded-lg border"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Stroke Color</label>
                  <input
                    type="color"
                    value={selectedShape.stroke || "#000000"}
                    onChange={(e) => updateShapeProperty("stroke", e.target.value || null)}
                    className="w-full h-10 rounded-lg border"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Stroke Width</label>
                  <input
                    type="number"
                    value={selectedShape.strokeWidth}
                    onChange={(e) => updateShapeProperty("strokeWidth", parseFloat(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Canva;