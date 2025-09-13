"use client";

import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Transformer, Image as KonvaImage, Line } from "react-konva";

const Canva = ({ excelData }) => {
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const fileInputRef = useRef(null);

  const canvasWidth = 1000;
  const canvasHeight = 600;
  const stageWidth = window.innerWidth - (selectedId ? 300 : 0);
  const stageHeight = window.innerHeight - 70;

  // =========================
  // Initialize Shapes from Excel Data
  // =========================
  useEffect(() => {
    if (excelData && excelData.length > 0) {
      const newShapes = excelData.map((row) => {
        const baseShape = {
          id: row.id || `shape${shapes.length + 1}`,
          type: row.type,
          name: row.name || `Shape_${shapes.length + 1}`,
          x: parseFloat(row.x) || 50,
          y: parseFloat(row.y) || 50,
          draggable: true,
        };

        if (row.type === "rect") {
          return {
            ...baseShape,
            width: parseFloat(row.width) || 120,
            height: parseFloat(row.height) || 100,
            fill: row.fill || "#ff4d4f",
          };
        } else if (row.type === "text") {
          return {
            ...baseShape,
            text: row.text || "Text",
            fontSize: parseInt(row.fontSize) || 22,
            fill: row.fill || "#333",
          };
        } else if (row.type === "image" && row.imageUrl) {
          const img = new window.Image();
          img.src = row.imageUrl;
          return {
            ...baseShape,
            width: parseFloat(row.width) || 120,
            height: parseFloat(row.height) || 120,
            image: img,
          };
        }
        return null;
      }).filter(Boolean);

      setShapes(newShapes);
    }
  }, [excelData]);

  // =========================
  // Shape Selection & Transformer
  // =========================
  const handleSelect = (e) => {
    const id = e.target.id();
    setSelectedId(id === selectedId ? null : id);
  };

  useEffect(() => {
    if (selectedId && transformerRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedId]);

  const handleStageClick = (e) => {
    if (e.target === stageRef.current) {
      
    }
    setSelectedId(null);
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

  const handleDragEnd = (e) => {
    setStagePos({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  // =========================
  // Adding Shapes (for manual testing)
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
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);
  };

  const addImage = () => fileInputRef.current.click();

  // =========================
  // Image Upload
  // =========================
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
                property === "width" || property === "height" || property === "fontSize"
                  ? Math.max(10, parseInt(value) || 10)
                  : value,
            }
          : shape
      )
    );
  };

  const selectedShape = shapes.find((shape) => shape.id === selectedId);

  // =========================
  // Render
  // =========================
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="p-3 bg-white shadow flex gap-3 items-center">
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
          <div className="ml-auto flex gap-2">
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
            draggable={!selectedId}
            onDragEnd={handleDragEnd}
            ref={stageRef}
            onMouseDown={handleStageClick}
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
              />

              {/* Grid */}
              {Array.from({ length: Math.ceil(canvasWidth / 50) }).map((_, i) => (
                <Line
                  key={`v${i}`}
                  points={[i * 50, 0, i * 50, canvasHeight]}
                  stroke="#eee"
                  strokeWidth={1 / scale}
                />
              ))}
              {Array.from({ length: Math.ceil(canvasHeight / 50) }).map((_, i) => (
                <Line
                  key={`h${i}`}
                  points={[0, i * 50, canvasWidth, i * 50]}
                  stroke="#eee"
                  strokeWidth={1 / scale}
                />
              ))}

              {/* Shapes */}
              {shapes.map((shape) => {
                if (shape.type === "rect")
                  return (
                    <Rect
                      key={shape.id}
                      id={shape.id}
                      {...shape}
                      onClick={handleSelect}
                      onMouseDown={handleSelect}
                      onDragEnd={(e) =>
                        setShapes((prev) =>
                          prev.map((s) =>
                            s.id === shape.id
                              ? { ...s, x: e.target.x(), y: e.target.y() }
                              : s
                          )
                        )
                      }
                      onTransformEnd={(e) => {
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
                      onDragEnd={(e) =>
                        setShapes((prev) =>
                          prev.map((s) =>
                            s.id === shape.id
                              ? { ...s, x: e.target.x(), y: e.target.y() }
                              : s
                          )
                        )
                      }
                      onTransformEnd={(e) => {
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
                      onDragEnd={(e) =>
                        setShapes((prev) =>
                          prev.map((s) =>
                            s.id === shape.id
                              ? { ...s, x: e.target.x(), y: e.target.y() }
                              : s
                          )
                        )
                      }
                      onTransformEnd={(e) => {
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
                    onChange={(e) =>
                      updateShapeProperty("width", Math.max(10, parseInt(e.target.value)))
                    }
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedShape.height}
                    onChange={(e) =>
                      updateShapeProperty("height", Math.max(10, parseInt(e.target.value)))
                    }
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
                    onChange={(e) =>
                      updateShapeProperty("fontSize", Math.max(10, parseInt(e.target.value)))
                    }
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
                    onChange={(e) =>
                      updateShapeProperty("width", Math.max(10, parseInt(e.target.value)))
                    }
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Height</label>
                  <input
                    type="number"
                    value={selectedShape.height}
                    onChange={(e) =>
                      updateShapeProperty("height", Math.max(10, parseInt(e.target.value)))
                    }
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