"use client";
import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Transformer, Image as KonvaImage, Line, Path } from "react-konva";
import Konva from "konva";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Navbar from "@/components/Navbar";

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
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState({});
  const [showBlankTemplate, setShowBlankTemplate] = useState(false);

  // =========================
  // UNDO/REDO STATE
  // =========================
  const [history, setHistory] = useState([]); // Array of past states
  const [future, setFuture] = useState([]);   // Array of future states (after undo)
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const stageWidth = window.innerWidth - (selectedId ? 300 : 0);
  const stageHeight = window.innerHeight - 70;

  // =========================
  // Blank Template Creation
  // =========================
  const handleCreateBlankTemplate = () => {
    setShowBlankTemplate(true);
  };

  const createBlankTemplate = (width, height) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
    setShapes([]);
    setPdfUploaded(true);
    setShowBlankTemplate(false);

    // Save initial state to history
    saveToHistory([]);
  };

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
      const page = data.pages[0];
      setCanvasWidth(page.width);
      setCanvasHeight(page.height);
      const newShapes = [];
      let idCounter = 1;
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
      newShapes.sort((a, b) => a.zIndex - b.zIndex);
      setShapes(newShapes);
      setPdfUploaded(true);

      // Save state to history
      saveToHistory(newShapes);
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
      setShowColumnMapping(true);
    };
    reader.readAsArrayBuffer(file);
  };

  // =========================
  // Column Mapping
  // =========================
  const handleMappingChange = (shapeId, columnName) => {
    setColumnMapping((prev) => ({
      ...prev,
      [shapeId]: columnName,
    }));
  };

  const saveColumnMapping = () => {
    // Create a new array of shapes with updated dataField
    const updatedShapes = shapes.map(shape => ({
      ...shape,
      dataField: columnMapping[shape.id] || null
    }));
    setShapes(updatedShapes);
    setShowColumnMapping(false);
    setColumnMapping({});

    // Save state to history
    saveToHistory(updatedShapes);
  };

  const cancelColumnMapping = () => {
    setColumnMapping({});
    setShowColumnMapping(false);
  };

  // =========================
  // Generate PNGs (FIXED - NO STATE MUTATION)
  // =========================
  const cloneShapes = (shapes) => {
    return shapes.map((shape) => {
      const cloned = { ...shape };
      if (shape.image) {
        // Deep clone the image by creating a new Image object with the same src
        const img = new window.Image();
        img.src = shape.image.src; // This is safe, we're not mutating the original
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
      // Create a DEEP COPY of the current shapes for this iteration
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

      // Render to off-screen stage
      const div = document.createElement("div");
      document.body.appendChild(div);
      const offStage = new Konva.Stage({
        container: div,
        width: canvasWidth,
        height: canvasHeight,
      });
      const layer = new Konva.Layer();
      offStage.add(layer);

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
            return;
        }
        layer.add(node);
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
    const id = e.target.id();
    setSelectedId(id);
  };

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      const selectedShape = shapes.find((s) => s.id === selectedId);
      if (node && selectedShape?.type !== "path") {
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

  // =========================
  // GLOBAL DRAG HANDLERS (FIXED: Prevents ANY drag interference)
  // =========================
  const handleLayerDragStart = (e) => {
    e.evt.preventDefault();
    e.evt.stopPropagation();
    if (stageRef.current) {
      stageRef.current.draggable(false);
    }
  };

  const handleLayerDragEnd = (e) => {
    e.evt.stopPropagation();

    const target = e.target;
    const shapeNode = target.getParent() || target;
    const shapeId = shapeNode.id();

    if (shapeId && shapeId !== "transformer") {
      setShapes((prev) =>
        prev.map((s) =>
          s.id === shapeId
            ? {
                ...s,
                x: shapeNode.x(),
                y: shapeNode.y(),
              }
            : s
        )
      );

      // Save state to history after any drag/transform
      saveToHistory(shapes.map(s => ({...s}))); // shallow clone each shape
    }

    if (stageRef.current) {
      stageRef.current.draggable(true);
    }
  };

  // =========================
  // OBJECT DELETION
  // =========================
  const deleteSelectedShape = () => {
    if (selectedId) {
      const updatedShapes = shapes.filter((shape) => shape.id !== selectedId);
      setShapes(updatedShapes);
      setSelectedId(null);

      // Save state to history
      saveToHistory(updatedShapes);
    }
  };

  // =========================
  // ADDING SHAPES (manual)
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
      fill: "#3b82f6",
      draggable: true,
      dataField: null,
      zIndex: shapes.length + 1,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);

    // Save state to history
    saveToHistory([...shapes, newShape]);
  };

  const addText = () => {
    const newShape = {
      id: `text${shapes.length + 1}`,
      type: "text",
      name: `Text_${shapes.length + 1}`,
      x: 60,
      y: 60,
      text: "Sample Text",
      fontSize: 20,
      fill: "#1f2937",
      draggable: true,
      dataField: null,
      zIndex: shapes.length + 1,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);

    // Save state to history
    saveToHistory([...shapes, newShape]);
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

        // Save state to history
        saveToHistory([...shapes, newShape]);
      };
    };
    reader.readAsDataURL(file);
  };

  // =========================
  // UPDATE SHAPE PROPERTIES
  // =========================
  const updateShapeProperty = (property, value) => {
    setShapes((prev) =>
      prev.map((shape) =>
        shape.id === selectedId
          ? {
              ...shape,
              [property]:
                property === "width" ||
                property === "height" ||
                property === "fontSize" ||
                property === "strokeWidth"
                  ? Math.max(0.1, parseFloat(value) || 0.1)
                  : property === "dataField"
                  ? value || null
                  : value,
            }
          : shape
      )
    );

    // Save state to history
    saveToHistory(shapes.map(s => ({...s})));
  };

  // =========================
  // Z-INDEX MANAGEMENT
  // =========================
  const moveToFront = () => {
    setShapes((prev) => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex((s) => s.id === selectedId);
      if (selectedIndex !== -1) {
        const [movedShape] = newShapes.splice(selectedIndex, 1);
        newShapes.push({ ...movedShape, zIndex: newShapes.length + 1 });
        return newShapes;
      }
      return prev;
    });

    // Save state to history
    saveToHistory(shapes.map(s => ({...s})));
  };

  const moveToBack = () => {
    setShapes((prev) => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex((s) => s.id === selectedId);
      if (selectedIndex !== -1) {
        const [movedShape] = newShapes.splice(selectedIndex, 1);
        newShapes.unshift({ ...movedShape, zIndex: 0 });
        return newShapes.map((shape, index) => ({
          ...shape,
          zIndex: index,
        }));
      }
      return prev;
    });

    // Save state to history
    saveToHistory(shapes.map(s => ({...s})));
  };

  const moveUp = () => {
    setShapes((prev) => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex((s) => s.id === selectedId);
      if (selectedIndex > 0) {
        [newShapes[selectedIndex - 1], newShapes[selectedIndex]] =
          [newShapes[selectedIndex], newShapes[selectedIndex - 1]];
        return newShapes.map((shape, index) => ({
          ...shape,
          zIndex: index,
        }));
      }
      return prev;
    });

    // Save state to history
    saveToHistory(shapes.map(s => ({...s})));
  };

  const moveDown = () => {
    setShapes((prev) => {
      const newShapes = [...prev];
      const selectedIndex = newShapes.findIndex((s) => s.id === selectedId);
      if (selectedIndex < newShapes.length - 1) {
        [newShapes[selectedIndex], newShapes[selectedIndex + 1]] =
          [newShapes[selectedIndex + 1], newShapes[selectedIndex]];
        return newShapes.map((shape, index) => ({
          ...shape,
          zIndex: index,
        }));
      }
      return prev;
    });

    // Save state to history
    saveToHistory(shapes.map(s => ({...s})));
  };

  // =========================
  // HISTORY MANAGEMENT
  // =========================
  const saveToHistory = (newState) => {
    // Always clear future stack when a new action is made
    setFuture([]);

    // Add the new state to history (deep clone)
    const serializedState = JSON.parse(JSON.stringify(newState));
    setHistory(prev => [...prev, serializedState]);
  };

  const undo = () => {
    if (history.length === 0) return;

    // Get the last state from history
    const lastState = history[history.length - 1];

    // Move it to future
    setFuture(prev => [...prev, lastState]);

    // Remove it from history
    setHistory(prev => prev.slice(0, -1));

    // Set shapes to the previous state
    setShapes(history[history.length - 2] || []); // If history has 1 item, go back to empty
  };

  const redo = () => {
    if (future.length === 0) return;

    // Get the next state from future
    const nextState = future[future.length - 1];

    // Move it to history
    setHistory(prev => [...prev, nextState]);

    // Remove it from future
    setFuture(prev => prev.slice(0, -1));

    // Set shapes to the next state
    setShapes(nextState);
  };

  const selectedShape = shapes.find((shape) => shape.id === selectedId);

  // =========================
  // RENDER
  // =========================
  if (showBlankTemplate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Blank Template</h1>
            <p className="text-gray-600">Set your canvas dimensions</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width (px)</label>
              <input
                type="number"
                defaultValue="1000"
                id="templateWidth"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (px)</label>
              <input
                type="number"
                defaultValue="600"
                id="templateHeight"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowBlankTemplate(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow hover:from-blue-600 hover:to-indigo-700 transition-all"
                onClick={() => {
                  const width = parseInt(document.getElementById("templateWidth").value) || 1000;
                  const height = parseInt(document.getElementById("templateHeight").value) || 600;
                  createBlankTemplate(width, height);
                }}
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pdfUploaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                ></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">PDF Template Designer</h1>
            <p className="text-gray-600">Choose how to start your project</p>
          </div>
          <div className="space-y-4">
            <input
              type="file"
              accept=".pdf"
              ref={pdfInputRef}
              className="hidden"
              onChange={handlePdfUpload}
            />
            <button
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center"
              onClick={() => pdfInputRef.current.click()}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              Upload PDF Template
            </button>
            <div className="relative flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500">or</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <button
              className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg shadow-md hover:from-green-600 hover:to-emerald-700 transition-all transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center justify-center"
              onClick={handleCreateBlankTemplate}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              Create Blank Template
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Column Mapping Interface
  if (showColumnMapping) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
              <h1 className="text-2xl font-bold text-white">Map Excel Columns to Objects</h1>
              <p className="text-blue-100 mt-1">Connect your data fields to design elements</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                      <svg
                        className="w-6 h-6 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                        ></path>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">Excel Columns</h2>
                  </div>
                  <div className="space-y-3">
                    {columns.length > 0 ? (
                      columns.map((col, index) => (
                        <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-medium">{index + 1}</span>
                          </div>
                          <span className="font-medium text-gray-700">{col}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No columns found in Excel file</div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mr-3">
                      <svg
                        className="w-6 h-6 text-indigo-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        ></path>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">Canvas Objects</h2>
                  </div>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {shapes.length > 0 ? (
                      shapes.map((shape) => (
                        <div key={shape.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-start">
                            <div className="mr-3 mt-1">
                              {shape.type === "text" && (
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg
                                    className="w-4 h-4 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    ></path>
                                  </svg>
                                </div>
                              )}
                              {shape.type === "image" && (
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                  <svg
                                    className="w-4 h-4 text-purple-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    ></path>
                                  </svg>
                                </div>
                              )}
                              {shape.type === "rect" && (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <svg
                                    className="w-4 h-4 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                                    ></path>
                                  </svg>
                                </div>
                              )}
                              {shape.type === "path" && (
                                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                                  <svg
                                    className="w-4 h-4 text-yellow-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                                    ></path>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">{shape.name}</div>
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Map to column:</label>
                                <select
                                  value={columnMapping[shape.id] || ""}
                                  onChange={(e) => handleMappingChange(shape.id, e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select column</option>
                                  {columns.map((col) => (
                                    <option key={col} value={col}>
                                      {col}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">No objects found in template</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={cancelColumnMapping}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow hover:from-blue-600 hover:to-indigo-700 transition-all"
                  onClick={saveColumnMapping}
                >
                  Save Mapping & Continue
                </button>
              </div>
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
        <div className="p-4 bg-white shadow-sm border-b flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors flex items-center"
              onClick={addRectangle}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                ></path>
              </svg>
              Rectangle
            </button>
            <button
              className="px-4 py-2 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200 transition-colors flex items-center"
              onClick={addText}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              Text
            </button>
            <button
              className="px-4 py-2 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 transition-colors flex items-center"
              onClick={addImage}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              Image
            </button>
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              className="px-4 py-2 bg-yellow-100 text-yellow-700 font-medium rounded-lg hover:bg-yellow-200 transition-colors flex items-center"
              onClick={() => excelInputRef.current.click()}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                ></path>
              </svg>
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
              className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors flex items-center"
              onClick={handleGenerate}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                ></path>
              </svg>
              Generate PNGs
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </button>
            <button
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                ></path>
              </svg>
            </button>
          </div>

          {/* UNDO/REDO BUTTONS */}
          <div className="flex gap-2 ml-4">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              ↺
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo"
            >
              ↻
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
            onDragStart={handleStageMouseDown}
            onDragEnd={handleStageMouseDown}
            ref={stageRef}
            onMouseDown={handleStageMouseDown}
            onWheel={handleWheel}
            style={{ backgroundColor: "#f3f4f6" }}
          >
            <Layer
              onDragStart={handleLayerDragStart}
              onDragEnd={handleLayerDragEnd}
            >
              {/* Canvas Background */}
              <Rect
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fill="#ffffff"
                stroke="#e5e7eb"
                strokeWidth={1 / scale}
                listening={false}
              />

              {/* Grid */}
              {Array.from({ length: Math.ceil(canvasWidth / 50) }).map((_, i) => (
                <Line
                  key={`v${i}`}
                  points={[i * 50, 0, i * 50, canvasHeight]}
                  stroke="#f3f4f6"
                  strokeWidth={1 / scale}
                  listening={false}
                />
              ))}
              {Array.from({ length: Math.ceil(canvasHeight / 50) }).map((_, i) => (
                <Line
                  key={`h${i}`}
                  points={[0, i * 50, canvasWidth, i * 50]}
                  stroke="#f3f4f6"
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
        className={`w-80 bg-white border-l shadow-lg transition-all duration-300 ease-in-out ${
          selectedId ? "block" : "hidden"
        }`}
      >
        <div className="p-5 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Properties</h2>
            <div className="flex gap-2">
              <button
                onClick={deleteSelectedShape}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                title="Delete Object"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </button>
              <button
                onClick={() => setSelectedId(null)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Close Panel"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
          {selectedShape && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6">
                {/* Object Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="mr-3">
                      {selectedShape.type === "text" && (
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                        </div>
                      )}
                      {selectedShape.type === "image" && (
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-purple-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            ></path>
                          </svg>
                        </div>
                      )}
                      {selectedShape.type === "rect" && (
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                            ></path>
                          </svg>
                        </div>
                      )}
                      {selectedShape.type === "path" && (
                        <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-yellow-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                            ></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{selectedShape.name}</div>
                      <div className="text-sm text-gray-500 capitalize">{selectedShape.type}</div>
                    </div>
                  </div>
                </div>

                {/* Z-Index Controls */}
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Layer Order</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center justify-center"
                      onClick={moveToFront}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                      To Front
                    </button>
                    <button
                      className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center justify-center"
                      onClick={moveToBack}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                      To Back
                    </button>
                    <button
                      className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center justify-center"
                      onClick={moveUp}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 15l7-7 7 7"
                        ></path>
                      </svg>
                      Move Up
                    </button>
                    <button
                      className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center justify-center"
                      onClick={moveDown}
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                      Move Down
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={selectedShape.name}
                    onChange={(e) => updateShapeProperty("name", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Data Mapping */}
                {(selectedShape.type === "text" || selectedShape.type === "image") && columns.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Map to Excel Column</label>
                    <select
                      value={selectedShape.dataField || ""}
                      onChange={(e) => updateShapeProperty("dataField", e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">None</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Type-specific properties */}
                {selectedShape.type === "rect" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fill Color</label>
                      <input
                        type="color"
                        value={selectedShape.fill}
                        onChange={(e) => updateShapeProperty("fill", e.target.value)}
                        className="w-full h-10 rounded-lg border border-gray-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                        <input
                          type="number"
                          value={selectedShape.width}
                          onChange={(e) => updateShapeProperty("width", parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                        <input
                          type="number"
                          value={selectedShape.height}
                          onChange={(e) => updateShapeProperty("height", parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedShape.type === "text" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Text Content</label>
                      <input
                        type="text"
                        value={selectedShape.text}
                        onChange={(e) => updateShapeProperty("text", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                        <input
                          type="number"
                          value={selectedShape.fontSize}
                          onChange={(e) => updateShapeProperty("fontSize", parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                        <input
                          type="color"
                          value={selectedShape.fill}
                          onChange={(e) => updateShapeProperty("fill", e.target.value)}
                          className="w-full h-10 rounded-lg border border-gray-300"
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedShape.type === "image" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                        <input
                          type="number"
                          value={selectedShape.width}
                          onChange={(e) => updateShapeProperty("width", parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                        <input
                          type="number"
                          value={selectedShape.height}
                          onChange={(e) => updateShapeProperty("height", parseInt(e.target.value))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedShape.type === "path" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fill Color</label>
                      <input
                        type="color"
                        value={selectedShape.fill || "#000000"}
                        onChange={(e) => updateShapeProperty("fill", e.target.value || null)}
                        className="w-full h-10 rounded-lg border border-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stroke Color</label>
                      <input
                        type="color"
                        value={selectedShape.stroke || "#000000"}
                        onChange={(e) => updateShapeProperty("stroke", e.target.value || null)}
                        className="w-full h-10 rounded-lg border border-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stroke Width</label>
                      <input
                        type="number"
                        value={selectedShape.strokeWidth}
                        onChange={(e) => updateShapeProperty("strokeWidth", parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Canva;