import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { createSnapModifier } from "@dnd-kit/modifiers";
import { supabase, getCharacterImageUrl } from "./supabaseClient";
import DraggableCharacter from "./DraggableCharacter";
import CharacterEditor from "./CharacterEditor";
import "./Grid.css";
import InitiativeTracker from "./InitiativeTracker";

const Grid = () => {
  // Grid state
  const [gridSize, setGridSize] = useState({ width: 20, height: 15 });
  const [squareSize, setSquareSize] = useState(50);
  const [measurementUnit, setMeasurementUnit] = useState("feet");
  const [unitSize, setUnitSize] = useState(5);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState([]);
  const [gridOffset, setGridOffset] = useState({ x: 0, y: 0 });
  const [isDraggingGrid, setIsDraggingGrid] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [isUpdatingHp, setIsUpdatingHp] = useState(false);
  const [hpAmount, setHpAmount] = useState("");
  const [localHp, setLocalHp] = useState(null);
  const [localStatus, setLocalStatus] = useState(null);
  const hpInputRef = useRef(null);

  // Spell measurement state
  const [spellShape, setSpellShape] = useState("none"); // none, circle, square, cone, line
  const [spellRange, setSpellRange] = useState(30); // in feet
  const [spellRotation, setSpellRotation] = useState(0); // in degrees
  const [spellOrigin, setSpellOrigin] = useState(null); // {x, y} grid coordinates

  // Drag distance state
  const [dragDistance, setDragDistance] = useState(null); // {squares, feet, meters}
  const [dragStartPosition, setDragStartPosition] = useState(null); // {x, y} grid coordinates

  // Character editor state
  const [showCharacterEditor, setShowCharacterEditor] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);

  // Custom stats state
  const [customStats, setCustomStats] = useState([]);
  const [showCustomStatsEditor, setShowCustomStatsEditor] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create snap modifier for grid snapping
  const snapToGrid = useMemo(
    () => createSnapModifier(squareSize),
    [squareSize]
  );

  // Load characters from database
  const loadCharacters = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;

      const { data, error } = await supabase
        .from("entity")
        .select("*")
        .eq("id_user", user.id_user);

      if (error) {
        console.error("Error loading characters:", error);
        return;
      }

      console.log("Raw character data from database:", data);

      // Fetch image URLs and initialize characters with grid positions
      const charactersWithPositions = await Promise.all(
        data.map(async (char) => {
          // Use the exact database positions, defaulting to 0 if null/undefined
          // Ensure positions are valid numbers
          let gridX = 0;
          let gridY = 0;

          if (char.positionx !== null && char.positionx !== undefined) {
            gridX = Number(char.positionx);
            if (isNaN(gridX)) gridX = 0;
          }

          if (char.positiony !== null && char.positiony !== undefined) {
            gridY = Number(char.positiony);
            if (isNaN(gridY)) gridY = 0;
          }

          console.log(
            `Character ${char.name}: DB position (${char.positionx}, ${char.positiony}) -> Grid position (${gridX}, ${gridY})`
          );

          // Fetch image URL from Supabase storage
          let imageUrl = char.image_url;
          if (!imageUrl) {
            try {
              imageUrl = await getCharacterImageUrl(char.id_entity);
            } catch (error) {
              console.error(
                `Error fetching image for character ${char.id_entity}:`,
                error
              );
            }
          }

          return {
            ...char,
            gridX,
            gridY,
            size: char.size || 1,
            image_url: imageUrl,
          };
        })
      );

      console.log("Final characters with positions:", charactersWithPositions);
      setCharacters(charactersWithPositions);
    } catch (error) {
      console.error("Error loading characters:", error);
    }
  };

  // Load custom stats for a character
  const loadCustomStats = async (characterId) => {
    try {
      const { data, error } = await supabase
        .from("customstat")
        .select("*")
        .eq("id_entity", characterId)
        .order("id_customstat");

      if (error) {
        console.error("Error loading custom stats:", error);
        return;
      }

      // Migrate old checkbox format to new format
      const migratedStats = data.map((stat) => {
        // Check if it's an old format checkbox (just 0s and 1s, no count prefix)
        if (/^[01]+$/.test(stat.stat) && stat.stat.length <= 10) {
          const count = stat.stat.length;
          const newValue = `${count}:${stat.stat}`;
          console.log(
            `Migrating checkbox stat from "${stat.stat}" to "${newValue}"`
          );

          // Update in database
          updateCustomStat({
            id_customstat: stat.id_customstat,
            stat: newValue,
          });

          return {
            ...stat,
            stat: newValue,
          };
        }
        return stat;
      });

      setCustomStats(migratedStats || []);
    } catch (error) {
      console.error("Error loading custom stats:", error);
    }
  };

  // Save custom stat to database
  const saveCustomStat = async (customStat) => {
    try {
      const { data, error } = await supabase
        .from("customstat")
        .insert([customStat])
        .select();

      if (error) {
        console.error("Error saving custom stat:", error);
        return null;
      }

      return data[0];
    } catch (error) {
      console.error("Error saving custom stat:", error);
      return null;
    }
  };

  // Update custom stat in database
  const updateCustomStat = async (customStat) => {
    try {
      const { data, error } = await supabase
        .from("customstat")
        .update(customStat)
        .eq("id_customstat", customStat.id_customstat)
        .select();

      if (error) {
        console.error("Error updating custom stat:", error);
        return null;
      }

      return data[0];
    } catch (error) {
      console.error("Error updating custom stat:", error);
      return null;
    }
  };

  // Delete custom stat from database
  const deleteCustomStat = async (customStatId) => {
    try {
      const { error } = await supabase
        .from("customstat")
        .delete()
        .eq("id_customstat", customStatId);

      if (error) {
        console.error("Error deleting custom stat:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting custom stat:", error);
      return false;
    }
  };

  // Load characters from database
  useEffect(() => {
    loadCharacters();
  }, []);

  // Mouse wheel handlers
  const handleWheel = (e) => {
    // Don't handle wheel events if character editor is open
    if (showCharacterEditor || showCharacterSheet) {
      return;
    }

    e.preventDefault();

    if (measurementMode) {
      // Rotate spell shape
      const delta = e.deltaY > 0 ? 15 : -15;
      setSpellRotation((prev) => (prev + delta) % 360);
    } else {
      // Adjust square size
      const delta = e.deltaY > 0 ? -5 : 5;
      setSquareSize((prev) => Math.max(20, Math.min(200, prev + delta)));
    }
  };

  // Character editor handlers
  const handleCreateCharacter = () => {
    setEditingCharacter(null);
    setShowCharacterEditor(true);
  };

  const handleEditCharacter = (character) => {
    setEditingCharacter(character);
    setShowCharacterEditor(true);
    setShowCharacterSheet(false);
  };

  const [initiativeRefresh, setInitiativeRefresh] = useState(0);

  const handleSaveCharacter = (savedCharacter) => {
    if (editingCharacter) {
      // Update existing character in the list
      const updatedCharacter = {
        ...savedCharacter,
        gridX:
          savedCharacter.positionx !== null &&
          savedCharacter.positionx !== undefined
            ? Number(savedCharacter.positionx)
            : 0,
        gridY:
          savedCharacter.positiony !== null &&
          savedCharacter.positiony !== undefined
            ? Number(savedCharacter.positiony)
            : 0,
        size: savedCharacter.size || 1,
      };

      console.log("Updated character with new positions:", updatedCharacter);

      setCharacters((prev) =>
        prev.map((char) =>
          char.id_entity === savedCharacter.id_entity ? updatedCharacter : char
        )
      );
    } else {
      // Add new character to the list
      let gridX = 0;
      let gridY = 0;

      if (
        savedCharacter.positionx !== null &&
        savedCharacter.positionx !== undefined
      ) {
        gridX = Number(savedCharacter.positionx);
        if (isNaN(gridX)) gridX = 0;
      }

      if (
        savedCharacter.positiony !== null &&
        savedCharacter.positiony !== undefined
      ) {
        gridY = Number(savedCharacter.positiony);
        if (isNaN(gridY)) gridY = 0;
      }

      const newCharacter = {
        ...savedCharacter,
        gridX,
        gridY,
        size: savedCharacter.size || 1,
      };
      console.log("New character with positions:", newCharacter);
      setCharacters((prev) => [...prev, newCharacter]);
    }
    setInitiativeRefresh((prev) => prev + 1);
  };

  // Delete character
  const handleDeleteCharacter = async (character) => {
    // Prevent deletion of main characters
    if (character.ismain) {
      alert(
        "Cannot delete main characters. Please uncheck 'Is Main Character' in the character editor first."
      );
      return;
    }

    try {
      // Delete from database
      const { error } = await supabase
        .from("entity")
        .delete()
        .eq("id_entity", character.id_entity);

      if (error) {
        console.error("Error deleting character:", error);
        return;
      }

      // Remove from local state
      setCharacters((prev) =>
        prev.filter((char) => char.id_entity !== character.id_entity)
      );

      // Close character sheet if it was open for this character
      if (selectedCharacter?.id_entity === character.id_entity) {
        setShowCharacterSheet(false);
        setSelectedCharacter(null);
      }
    } catch (error) {
      console.error("Error deleting character:", error);
    }
  };

  // Grid navigation with right mouse drag
  const handleMouseDown = (e) => {
    if (e.button === 2) {
      e.preventDefault();
      setIsDraggingGrid(true);
      setDragStart({
        x: e.clientX - gridOffset.x,
        y: e.clientY - gridOffset.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDraggingGrid) {
      setGridOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingGrid(false);
  };

  // Prevent context menu on right click
  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  // Grid click for measurement
  const handleGridClick = (e) => {
    if (!measurementMode) return;

    // Get the grid container element
    const gridElement = document.querySelector(".grid");
    if (!gridElement) return;

    const gridRect = gridElement.getBoundingClientRect();

    // Calculate the click position relative to the grid
    const clickX = e.clientX - gridRect.left;
    const clickY = e.clientY - gridRect.top;

    // Convert to grid coordinates
    const x = Math.floor((clickX - gridOffset.x) / squareSize);
    const y = Math.floor((clickY - gridOffset.y) / squareSize);

    if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
      setSpellOrigin({ x, y });
      setMeasurementPoints((prev) => {
        let newPoints;
        if (prev.length === 2) {
          // Replace the newest point (second one) with the new click
          newPoints = [prev[0], { x, y }];
        } else {
          // Add new point
          newPoints = [...prev, { x, y }];
        }
        return newPoints;
      });
    }
  };

  // Calculate distance
  const calculateDistance = (point1, point2) => {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const distanceInSquares = Math.sqrt(dx * dx + dy * dy);

    if (measurementUnit === "feet") {
      const distanceInFeet = distanceInSquares * unitSize;
      const distanceInMeters = distanceInFeet * 0.3048;
      return {
        feet: Math.round(distanceInFeet * 10) / 10,
        meters: Math.round(distanceInMeters * 10) / 10,
        squares: Math.round(distanceInSquares * 10) / 10,
      };
    } else {
      const distanceInMeters = distanceInSquares * unitSize;
      const distanceInFeet = distanceInMeters * 3.28084;
      return {
        feet: Math.round(distanceInFeet * 10) / 10,
        meters: Math.round(distanceInMeters * 10) / 10,
        squares: Math.round(distanceInSquares * 10) / 10,
      };
    }
  };

  // Calculate spell range in grid squares
  const getSpellRangeInSquares = () => {
    return Math.ceil(spellRange / unitSize);
  };

  // DnD Kit drag start handler
  const handleDragStart = (event) => {
    const { active } = event;
    console.log("Drag start event:", { active });

    if (active) {
      const draggedCharacter = characters.find(
        (char) => char.id_entity.toString() === active.id
      );

      if (draggedCharacter) {
        setActiveCharacter(draggedCharacter);
        // Store the starting position for distance calculation
        setDragStartPosition({
          x: draggedCharacter.gridX,
          y: draggedCharacter.gridY,
        });
        setDragDistance(null); // Reset distance
      }
    }
  };

  const handleDragMove = (event) => {
    const { active, delta } = event;

    if (active && dragStartPosition) {
      // Calculate current position based on delta
      const deltaInSquaresX = Math.round(delta.x / squareSize);
      const deltaInSquaresY = Math.round(delta.y / squareSize);

      const currentX = dragStartPosition.x + deltaInSquaresX;
      const currentY = dragStartPosition.y + deltaInSquaresY;

      // Calculate distance from start to current position
      const distance = calculateDistance(dragStartPosition, {
        x: currentX,
        y: currentY,
      });

      setDragDistance(distance);
    }
  };

  // DnD Kit drag end handler with proper grid snapping
  const handleDragEnd = (event) => {
    const { active, delta } = event;
    console.log("Drag end event:", { active, delta });

    if (active) {
      // Find the character being dragged
      const draggedCharacter = characters.find(
        (char) => char.id_entity.toString() === active.id
      );

      if (draggedCharacter) {
        console.log("Dragged character:", draggedCharacter);
        console.log("Current grid offset:", gridOffset);

        // Since we're using snapToGrid modifier, the delta should already be snapped
        // Convert the snapped delta to grid squares
        const deltaInSquaresX = Math.round(delta.x / squareSize);
        const deltaInSquaresY = Math.round(delta.y / squareSize);

        console.log("Delta in grid squares:", {
          deltaInSquaresX,
          deltaInSquaresY,
        });

        // Calculate the new position by adding the delta to the current position
        const newGridX = draggedCharacter.gridX + deltaInSquaresX;
        const newGridY = draggedCharacter.gridY + deltaInSquaresY;

        console.log("New grid position:", { newGridX, newGridY });

        // Ensure character stays within grid bounds
        const clampedX = Math.max(
          0,
          Math.min(newGridX, gridSize.width - draggedCharacter.size)
        );
        const clampedY = Math.max(
          0,
          Math.min(newGridY, gridSize.height - draggedCharacter.size)
        );

        console.log("Clamped position:", { clampedX, clampedY });

        // Only update if the position actually changed
        if (
          clampedX !== draggedCharacter.gridX ||
          clampedY !== draggedCharacter.gridY
        ) {
          // Update character position
          const updatedCharacters = characters.map((char) =>
            char.id_entity === draggedCharacter.id_entity
              ? { ...char, gridX: clampedX, gridY: clampedY }
              : char
          );

          setCharacters(updatedCharacters);

          // Update position in database
          console.log(
            "Updating database position for character:",
            draggedCharacter.id_entity
          );
          updateCharacterPosition(
            draggedCharacter.id_entity,
            clampedX,
            clampedY
          );
        } else {
          console.log("Position unchanged, no update needed");
        }
      }
    }

    setActiveCharacter(null);
    setDragStartPosition(null);
    setDragDistance(null);
  };

  // Character click handler with measurement support
  const handleCharacterClick = (character) => {
    if (measurementMode) {
      // Use character position as measurement point
      const x = character.gridX;
      const y = character.gridY;

      setSpellOrigin({ x, y });
      setMeasurementPoints((prev) => {
        let newPoints;
        if (prev.length === 2) {
          // Replace the newest point (second one) with the character position
          newPoints = [prev[0], { x, y }];
        } else {
          // Add character position as new point
          newPoints = [...prev, { x, y }];
        }
        return newPoints;
      });
    } else {
      // Normal character sheet behavior
      if (!showCharacterSheet) {
        setSelectedCharacter(character);
        setLocalHp(character.currenthp);
        setShowCharacterSheet(true);
        // Load custom stats for this character
        loadCustomStats(character.id_entity);
      }
    }
  };

  // Update character position in database
  const updateCharacterPosition = async (characterId, x, y) => {
    console.log("updateCharacterPosition called with:", { characterId, x, y });
    try {
      const { error } = await supabase
        .from("entity")
        .update({ positionx: x, positiony: y })
        .eq("id_entity", characterId);

      if (error) {
        console.error("Error updating character position:", error);
      } else {
        console.log("Successfully updated character position in database");
      }
    } catch (error) {
      console.error("Error updating character position:", error);
    }
  };

  // Save HP changes to database
  const saveCharacterChanges = async () => {
    if (!selectedCharacter) return;

    let hasChanges = false;
    const updates = {};

    // Check for HP changes
    if (localHp !== null && localHp !== selectedCharacter.currenthp) {
      updates.currenthp = localHp;
      hasChanges = true;
    }

    // Check for status changes
    if (localStatus !== null && localStatus !== selectedCharacter.status) {
      updates.status = localStatus;
      hasChanges = true;
    }

    if (hasChanges) {
      try {
        // Update in database silently
        const { error } = await supabase
          .from("entity")
          .update(updates)
          .eq("id_entity", selectedCharacter.id_entity);

        if (error) {
          console.error("Error updating character:", error);
          return;
        }

        // Update local state silently without triggering re-renders
        setCharacters((prev) =>
          prev.map((char) =>
            char.id_entity === selectedCharacter.id_entity
              ? { ...char, ...updates }
              : char
          )
        );

        console.log("Character changes saved to database:", updates);
      } catch (error) {
        console.error("Error updating character:", error);
      }
    }

    // Reset local states
    setLocalHp(null);
    setLocalStatus(null);
  };

  // Render spell shape
  const renderSpellShape = () => {
    if (!spellOrigin || spellShape === "none") return null;

    const rangeInSquares = getSpellRangeInSquares();
    const centerX = spellOrigin.x * squareSize + gridOffset.x + squareSize / 2;
    const centerY = spellOrigin.y * squareSize + gridOffset.y + squareSize / 2;
    const radius = rangeInSquares * squareSize;

    switch (spellShape) {
      case "circle":
        return (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 400,
            }}
          >
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="rgba(255, 107, 107, 0.2)"
              stroke="#ff6b6b"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
        );

      case "square":
        const halfSize = radius;
        return (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 400,
            }}
          >
            <rect
              x={centerX - halfSize}
              y={centerY - halfSize}
              width={radius * 2}
              height={radius * 2}
              fill="rgba(255, 107, 107, 0.2)"
              stroke="#ff6b6b"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
        );

      case "cone":
        const angleRad = (spellRotation * Math.PI) / 180;
        const coneAngle = Math.PI / 3; // 60 degrees
        const startAngle = angleRad - coneAngle / 2;
        const endAngle = angleRad + coneAngle / 2;

        const x1 = centerX + Math.cos(startAngle) * radius;
        const y1 = centerY + Math.sin(startAngle) * radius;
        const x2 = centerX + Math.cos(endAngle) * radius;
        const y2 = centerY + Math.sin(endAngle) * radius;

        const largeArcFlag = coneAngle > Math.PI ? 1 : 0;

        return (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 400,
            }}
          >
            <path
              d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
              fill="rgba(255, 107, 107, 0.2)"
              stroke="#ff6b6b"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
        );

      case "line":
        const lineAngle = (spellRotation * Math.PI) / 180;
        const endX = centerX + Math.cos(lineAngle) * radius;
        const endY = centerY + Math.sin(lineAngle) * radius;

        return (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 400,
            }}
          >
            <line
              x1={centerX}
              y1={centerY}
              x2={endX}
              y2={endY}
              stroke="#ff6b6b"
              strokeWidth="4"
              strokeDasharray="5,5"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  // Simple grid rendering
  const renderGrid = () => {
    const grid = [];
    for (let y = 0; y < gridSize.height; y++) {
      for (let x = 0; x < gridSize.width; x++) {
        const isMeasurementPoint = measurementPoints.some(
          (point) => point.x === x && point.y === y
        );
        grid.push(
          <div
            key={`${x}-${y}`}
            className={`grid-square ${
              isMeasurementPoint ? "measurement-point" : ""
            }`}
            style={{
              left: x * squareSize + gridOffset.x,
              top: y * squareSize + gridOffset.y,
              width: squareSize,
              height: squareSize,
            }}
            onClick={handleGridClick}
          />
        );
      }
    }
    return grid;
  };

  // Render top row numbers (1, 2, 3, etc.)
  const renderTopNumbers = () => {
    const numbers = [];
    for (let x = 0; x < gridSize.width; x++) {
      numbers.push(
        <div
          key={`top-${x}`}
          className="grid-coordinate top-number"
          style={{
            left: x * squareSize + gridOffset.x,
            top: gridOffset.y - 25,
            width: squareSize,
            height: 25,
          }}
        >
          {x + 1}
        </div>
      );
    }
    return numbers;
  };

  // Render left column letters (A, B, C, etc.)
  const renderLeftLetters = () => {
    const letters = [];
    for (let y = 0; y < gridSize.height; y++) {
      letters.push(
        <div
          key={`left-${y}`}
          className="grid-coordinate left-letter"
          style={{
            left: gridOffset.x - 25,
            top: y * squareSize + gridOffset.y,
            width: 25,
            height: squareSize,
          }}
        >
          {String.fromCharCode(65 + y)}
        </div>
      );
    }
    return letters;
  };

  // Render measurement line between points
  const renderMeasurementLine = () => {
    if (measurementPoints.length !== 2) return null;

    const [point1, point2] = measurementPoints;
    const x1 = point1.x * squareSize + gridOffset.x + squareSize / 2;
    const y1 = point1.y * squareSize + gridOffset.y + squareSize / 2;
    const x2 = point2.x * squareSize + gridOffset.x + squareSize / 2;
    const y2 = point2.y * squareSize + gridOffset.y + squareSize / 2;

    return (
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 500,
        }}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#ff6b6b"
          strokeWidth="3"
          strokeDasharray="5,5"
          opacity="0.8"
        />
      </svg>
    );
  };

  // Render movement range indicator
  const renderMovementRange = () => {
    if (!activeCharacter || !activeCharacter.speed) return null;

    // Convert speed from feet to grid squares
    const speedInSquares = Math.ceil(activeCharacter.speed / unitSize);
    const centerX =
      activeCharacter.gridX * squareSize + gridOffset.x + squareSize / 2;
    const centerY =
      activeCharacter.gridY * squareSize + gridOffset.y + squareSize / 2;
    const radius = speedInSquares * squareSize;

    return (
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 300,
        }}
      >
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="rgba(97, 218, 251, 0.1)"
          stroke="#61dafb"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      </svg>
    );
  };

  // Character Sheet Modal
  const CharacterSheet = () => {
    // Local state for custom stats to prevent component re-renders
    const [localCustomStats, setLocalCustomStats] = useState(customStats);

    // Update local stats when customStats changes (when component mounts or stats are loaded)
    useEffect(() => {
      setLocalCustomStats(customStats);
    }, [customStats]);

    if (!selectedCharacter) return null;

    const handleHpChange = (amount) => {
      const newHp = Math.max(
        0,
        Math.min(selectedCharacter.maxhp, localHp + amount)
      );

      if (newHp !== localHp) {
        setLocalHp(newHp);
        console.log(`HP updated locally: ${localHp} → ${newHp}`);
      }
    };

    const handleStatusChange = (newStatus) => {
      setLocalStatus(newStatus);
    };

    const handleNumberPadClick = (number) => {
      const currentValue = hpAmount === "" ? "" : hpAmount;
      const newValue = currentValue + number.toString();
      // Limit to 3 digits
      if (newValue.length <= 3) {
        setHpAmount(newValue);
      }
    };

    const handleNumberPadClear = () => {
      setHpAmount("");
    };

    // Custom stats handlers for inline editing
    const handleCustomStatNumericChange = async (
      statId,
      currentValue,
      change
    ) => {
      const newValue = Math.max(0, parseInt(currentValue) + change);

      // Update local state immediately for instant feedback
      setLocalCustomStats((prev) =>
        prev.map((stat) =>
          stat.id_customstat === statId
            ? { ...stat, stat: newValue.toString() }
            : stat
        )
      );

      // Save to database silently without triggering re-renders
      try {
        await updateCustomStat({
          id_customstat: statId,
          stat: newValue.toString(),
        });
      } catch (error) {
        console.error("Error updating custom stat:", error);
        // Revert on error
        setLocalCustomStats((prev) =>
          prev.map((stat) =>
            stat.id_customstat === statId
              ? { ...stat, stat: currentValue }
              : stat
          )
        );
      }
    };

    const handleCustomStatCheckboxToggle = async (
      statId,
      currentValue,
      index
    ) => {
      const [count, values] = currentValue.split(":");
      const checkboxValues = values || "";
      const newValues = checkboxValues.split("");
      newValues[index] = newValues[index] === "1" ? "0" : "1";
      const newStatValue = `${count}:${newValues.join("")}`;

      // Update local state immediately for instant feedback
      setLocalCustomStats((prev) =>
        prev.map((stat) =>
          stat.id_customstat === statId ? { ...stat, stat: newStatValue } : stat
        )
      );

      // Save to database silently without triggering re-renders
      try {
        await updateCustomStat({
          id_customstat: statId,
          stat: newStatValue,
        });
      } catch (error) {
        console.error("Error updating custom stat:", error);
        // Revert on error
        setLocalCustomStats((prev) =>
          prev.map((stat) =>
            stat.id_customstat === statId
              ? { ...stat, stat: currentValue }
              : stat
          )
        );
      }
    };

    const renderCustomStatValue = (stat) => {
      // Determine stat type based on content
      const isNumeric = !isNaN(stat.stat) && stat.stat !== "";
      const isCheckbox =
        /^\d+:[01]+$/.test(stat.stat) && stat.stat.length <= 20;

      if (isNumeric) {
        return (
          <div className="custom-stat-numeric">
            <button
              onClick={() =>
                handleCustomStatNumericChange(
                  stat.id_customstat,
                  stat.stat,
                  -10
                )
              }
              className="custom-numeric-button"
            >
              -10
            </button>
            <button
              onClick={() =>
                handleCustomStatNumericChange(stat.id_customstat, stat.stat, -5)
              }
              className="custom-numeric-button"
            >
              -5
            </button>
            <button
              onClick={() =>
                handleCustomStatNumericChange(stat.id_customstat, stat.stat, -1)
              }
              className="custom-numeric-button"
            >
              -1
            </button>
            <span className="custom-numeric-value">{stat.stat}</span>
            <button
              onClick={() =>
                handleCustomStatNumericChange(stat.id_customstat, stat.stat, 1)
              }
              className="custom-numeric-button"
            >
              +1
            </button>
            <button
              onClick={() =>
                handleCustomStatNumericChange(stat.id_customstat, stat.stat, 5)
              }
              className="custom-numeric-button"
            >
              +5
            </button>
            <button
              onClick={() =>
                handleCustomStatNumericChange(stat.id_customstat, stat.stat, 10)
              }
              className="custom-numeric-button"
            >
              +10
            </button>
          </div>
        );
      } else if (isCheckbox) {
        const [count, values] = stat.stat.split(":");
        const checkboxCount = parseInt(count);
        const checkboxValues = values || "";

        return (
          <div className="custom-stat-checkbox">
            {Array.from({ length: checkboxCount }, (_, index) => (
              <input
                key={index}
                type="checkbox"
                checked={checkboxValues[index] === "1"}
                onChange={() =>
                  handleCustomStatCheckboxToggle(
                    stat.id_customstat,
                    stat.stat,
                    index
                  )
                }
                className="custom-checkbox-input"
              />
            ))}
          </div>
        );
      } else {
        return (
          <div className="custom-stat-text">
            <textarea
              value={stat.stat}
              onChange={(e) => {
                const newValue = e.target.value;
                // Update local state immediately for instant feedback
                setLocalCustomStats((prev) =>
                  prev.map((s) =>
                    s.id_customstat === stat.id_customstat
                      ? { ...s, stat: newValue }
                      : s
                  )
                );
                // Save to database silently
                updateCustomStat({
                  id_customstat: stat.id_customstat,
                  stat: newValue,
                }).catch((error) => {
                  console.error("Error updating custom stat:", error);
                });
              }}
              className="custom-text-input"
              rows="2"
            />
          </div>
        );
      }
    };

    return (
      <div
        className="character-sheet-overlay"
        onClick={() => {
          setShowCharacterSheet(false);
          setTimeout(saveCharacterChanges, 50);
        }}
      >
        <div className="character-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="character-sheet-header">
            <h2>{selectedCharacter.name}</h2>
            <div className="character-sheet-actions">
              <button
                onClick={() => handleEditCharacter(selectedCharacter)}
                className="edit-button"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => handleDeleteCharacter(selectedCharacter)}
                className="delete-button"
                disabled={selectedCharacter.ismain}
                title={
                  selectedCharacter.ismain
                    ? "Cannot delete main characters. Uncheck 'Is Main Character' in the character editor first."
                    : "Delete character"
                }
              >
                🗑️ Delete
              </button>
              <button
                onClick={() => {
                  setShowCharacterSheet(false);
                  setTimeout(saveCharacterChanges, 50);
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div className="character-sheet-content">
            <div className="character-stats">
              <h3>Basic Info</h3>
              <p>
                <strong>Level:</strong> {selectedCharacter.level}
              </p>
              <div className="status-editor">
                <strong>Status:</strong>
                <select
                  value={
                    localStatus !== null
                      ? localStatus
                      : selectedCharacter.status
                  }
                  onChange={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleStatusChange(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onBlur={(e) => e.stopPropagation()}
                  className="status-select"
                >
                  <option value="Alive">Alive</option>
                  <option value="Unconscious">Unconscious</option>
                  <option value="Dead">Dead</option>
                  <option value="Stunned">Stunned</option>
                  <option value="Paralyzed">Paralyzed</option>
                  <option value="Petrified">Petrified</option>
                  <option value="Poisoned">Poisoned</option>
                  <option value="Blinded">Blinded</option>
                  <option value="Deafened">Deafened</option>
                  <option value="Charmed">Charmed</option>
                  <option value="Frightened">Frightened</option>
                  <option value="Grappled">Grappled</option>
                  <option value="Incapacitated">Incapacitated</option>
                  <option value="Invisible">Invisible</option>
                  <option value="Prone">Prone</option>
                  <option value="Restrained">Restrained</option>
                  <option value="Exhausted">Exhausted</option>
                </select>
              </div>
              <p>
                <strong>Position:</strong> ({selectedCharacter.positionx},{" "}
                {selectedCharacter.positiony})
              </p>

              <h3>Combat</h3>
              <p>
                <strong>Armor Class:</strong> {selectedCharacter.armorclass}
              </p>
              <p>
                <strong>Max HP:</strong> {selectedCharacter.maxhp}
              </p>

              {/* Quick HP Editing */}
              <div
                className="quick-hp-editor"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
              >
                <div className="hp-display">
                  <strong>Current HP:</strong> {localHp}
                  <div className="hp-bar">
                    <div
                      className="hp-fill"
                      style={{
                        width: `${(localHp / selectedCharacter.maxhp) * 100}%`,
                        backgroundColor:
                          localHp > selectedCharacter.maxhp * 0.5
                            ? "#4CAF50"
                            : localHp > selectedCharacter.maxhp * 0.25
                            ? "#FF9800"
                            : "#F44336",
                      }}
                    ></div>
                  </div>
                </div>

                <div
                  className="hp-controls"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                >
                  <div className="hp-input-group">
                    <button
                      className="hp-button hp-heal"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleHpChange(parseInt(hpAmount) || 0);
                      }}
                      disabled={
                        isUpdatingHp || localHp >= selectedCharacter.maxhp
                      }
                      title={`Heal ${parseInt(hpAmount) || 0} HP`}
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={hpAmount}
                      onChange={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Update local state immediately without triggering re-renders
                        setHpAmount(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onKeyUp={(e) => e.stopPropagation()}
                      onKeyPress={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      onBlur={(e) => e.stopPropagation()}
                      onInput={(e) => e.stopPropagation()}
                      className="hp-amount-input"
                      min="0"
                      max="999"
                      ref={hpInputRef}
                    />
                    <button
                      className="hp-button hp-damage"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleHpChange(-parseInt(hpAmount) || 0);
                      }}
                      disabled={isUpdatingHp || localHp <= 0}
                      title={`Take ${parseInt(hpAmount) || 0} damage`}
                    >
                      -
                    </button>
                  </div>

                  {/* Number Pad */}
                  <div className="number-pad">
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(1);
                      }}
                    >
                      1
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(2);
                      }}
                    >
                      2
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(3);
                      }}
                    >
                      3
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(4);
                      }}
                    >
                      4
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(5);
                      }}
                    >
                      5
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(6);
                      }}
                    >
                      6
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(7);
                      }}
                    >
                      7
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(8);
                      }}
                    >
                      8
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(9);
                      }}
                    >
                      9
                    </button>
                    <button
                      className="number-pad-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClick(0);
                      }}
                    >
                      0
                    </button>
                    <button
                      className="number-pad-button number-pad-clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNumberPadClear();
                      }}
                    >
                      C
                    </button>
                  </div>
                </div>
              </div>

              <p>
                <strong>Speed:</strong> {selectedCharacter.speed} ft
              </p>
              <p>
                <strong>Initiative Bonus:</strong>{" "}
                {selectedCharacter.initiativebonus}
              </p>

              <h3>Ability Scores</h3>
              <div className="ability-scores">
                <p>
                  <strong>STR:</strong> {selectedCharacter.strength}
                </p>
                <p>
                  <strong>DEX:</strong> {selectedCharacter.dexterity}
                </p>
                <p>
                  <strong>INT:</strong> {selectedCharacter.intelligence}
                </p>
                <p>
                  <strong>WIS:</strong> {selectedCharacter.wisdom}
                </p>
                <p>
                  <strong>CHA:</strong> {selectedCharacter.charisma}
                </p>
              </div>

              <h3>Notes</h3>
              <p>{selectedCharacter.notes || "No notes available"}</p>

              <h3>Custom Stats</h3>
              <button
                onClick={() => setShowCustomStatsEditor(true)}
                className="custom-stats-button"
              >
                ✏️ Manage Custom Stats
              </button>

              {localCustomStats.length > 0 ? (
                <div className="custom-stats-display">
                  {localCustomStats.map((stat) => (
                    <div key={stat.id_customstat} className="custom-stat-item">
                      <div className="custom-stat-header">
                        <strong>{stat.statname}:</strong>
                      </div>
                      {renderCustomStatValue(stat)}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No custom stats defined</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Custom Stats Editor Modal
  const CustomStatsEditor = () => {
    const [newStat, setNewStat] = useState({
      statname: "",
      stat: "",
      type: "numeric", // numeric, checkbox, text
      checkboxCount: 5,
      numericValue: 0,
    });
    const [editingStat, setEditingStat] = useState(null);

    const handleCreateStat = async () => {
      if (!newStat.statname.trim()) return;

      let statValue = "";
      switch (newStat.type) {
        case "numeric":
          statValue = newStat.numericValue.toString();
          break;
        case "checkbox":
          statValue = `${newStat.checkboxCount}:${"0".repeat(
            newStat.checkboxCount
          )}`;
          break;
        case "text":
          statValue = newStat.stat;
          break;
        default:
          statValue = newStat.stat;
          break;
      }

      const customStatData = {
        statname: newStat.statname.trim(),
        stat: statValue,
        id_entity: selectedCharacter.id_entity,
      };

      const savedStat = await saveCustomStat(customStatData);
      if (savedStat) {
        setCustomStats((prev) => [...prev, savedStat]);
        setNewStat({
          statname: "",
          stat: "",
          type: "numeric",
          checkboxCount: 5,
          numericValue: 0,
        });
      }
    };

    const handleUpdateStat = async (statId, updates) => {
      const updatedStat = await updateCustomStat({
        id_customstat: statId,
        ...updates,
      });
      if (updatedStat) {
        setCustomStats((prev) =>
          prev.map((stat) =>
            stat.id_customstat === statId ? updatedStat : stat
          )
        );
        setEditingStat(null);
      }
    };

    const handleDeleteStat = async (statId) => {
      const success = await deleteCustomStat(statId);
      if (success) {
        setCustomStats((prev) =>
          prev.filter((stat) => stat.id_customstat !== statId)
        );
      }
    };

    const handleNumericChange = async (statId, currentValue, change) => {
      const newValue = Math.max(0, parseInt(currentValue) + change);

      // Update local state immediately for instant feedback
      setCustomStats((prev) =>
        prev.map((stat) =>
          stat.id_customstat === statId
            ? { ...stat, stat: newValue.toString() }
            : stat
        )
      );

      // Save to database silently
      try {
        await updateCustomStat({
          id_customstat: statId,
          stat: newValue.toString(),
        });
      } catch (error) {
        console.error("Error updating custom stat:", error);
        // Revert on error
        setCustomStats((prev) =>
          prev.map((stat) =>
            stat.id_customstat === statId
              ? { ...stat, stat: currentValue }
              : stat
          )
        );
      }
    };

    const handleCheckboxToggle = async (statId, currentValue, index) => {
      const [count, values] = currentValue.split(":");
      const checkboxValues = values || "";
      const newValues = checkboxValues.split("");
      newValues[index] = newValues[index] === "1" ? "0" : "1";
      const newStatValue = `${count}:${newValues.join("")}`;

      // Update local state immediately for instant feedback
      setCustomStats((prev) =>
        prev.map((stat) =>
          stat.id_customstat === statId ? { ...stat, stat: newStatValue } : stat
        )
      );

      // Save to database silently without triggering re-renders
      try {
        await updateCustomStat({
          id_customstat: statId,
          stat: newStatValue,
        });
      } catch (error) {
        console.error("Error updating custom stat:", error);
        // Revert on error
        setCustomStats((prev) =>
          prev.map((stat) =>
            stat.id_customstat === statId
              ? { ...stat, stat: currentValue }
              : stat
          )
        );
      }
    };

    const renderStatEditor = (stat) => {
      if (editingStat !== stat.id_customstat) {
        return (
          <div className="custom-stat-display">
            <strong>{stat.statname}:</strong> {stat.stat}
            <div className="custom-stat-actions">
              <button
                onClick={() => setEditingStat(stat.id_customstat)}
                className="edit-stat-button"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDeleteStat(stat.id_customstat)}
                className="delete-stat-button"
              >
                🗑️
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="custom-stat-edit">
          <input
            type="text"
            value={stat.statname}
            onChange={(e) =>
              handleUpdateStat(stat.id_customstat, {
                statname: e.target.value,
              })
            }
            className="stat-name-input"
          />
          <button
            onClick={() => setEditingStat(null)}
            className="save-stat-button"
          >
            ✓
          </button>
        </div>
      );
    };

    const renderStatValue = (stat) => {
      // Determine stat type based on content
      const isNumeric = !isNaN(stat.stat) && stat.stat !== "";
      const isCheckbox =
        /^\d+:[01]+$/.test(stat.stat) && stat.stat.length <= 20;

      if (isNumeric) {
        return (
          <div className="numeric-stat">
            <button
              onClick={() =>
                handleNumericChange(stat.id_customstat, stat.stat, -10)
              }
              className="numeric-button"
            >
              -10
            </button>
            <button
              onClick={() =>
                handleNumericChange(stat.id_customstat, stat.stat, -5)
              }
              className="numeric-button"
            >
              -5
            </button>
            <button
              onClick={() =>
                handleNumericChange(stat.id_customstat, stat.stat, -1)
              }
              className="numeric-button"
            >
              -1
            </button>
            <span className="numeric-value">{stat.stat}</span>
            <button
              onClick={() =>
                handleNumericChange(stat.id_customstat, stat.stat, 1)
              }
              className="numeric-button"
            >
              +1
            </button>
            <button
              onClick={() =>
                handleNumericChange(stat.id_customstat, stat.stat, 5)
              }
              className="numeric-button"
            >
              +5
            </button>
            <button
              onClick={() =>
                handleNumericChange(stat.id_customstat, stat.stat, 10)
              }
              className="numeric-button"
            >
              +10
            </button>
          </div>
        );
      } else if (isCheckbox) {
        const [count, values] = stat.stat.split(":");
        const checkboxCount = parseInt(count);
        const checkboxValues = values || "";

        return (
          <div className="checkbox-stat">
            {Array.from({ length: checkboxCount }, (_, index) => (
              <input
                key={index}
                type="checkbox"
                checked={checkboxValues[index] === "1"}
                onChange={() =>
                  handleCheckboxToggle(stat.id_customstat, stat.stat, index)
                }
                className="checkbox-input"
              />
            ))}
          </div>
        );
      } else {
        return (
          <div className="text-stat">
            <textarea
              value={stat.stat}
              onChange={(e) => {
                const newValue = e.target.value;
                // Update local state immediately for instant feedback
                setCustomStats((prev) =>
                  prev.map((s) =>
                    s.id_customstat === stat.id_customstat
                      ? { ...s, stat: newValue }
                      : s
                  )
                );
                // Save to database silently
                updateCustomStat({
                  id_customstat: stat.id_customstat,
                  stat: newValue,
                }).catch((error) => {
                  console.error("Error updating custom stat:", error);
                });
              }}
              className="text-stat-input"
              rows="3"
            />
          </div>
        );
      }
    };

    return (
      <div
        className="custom-stats-editor-overlay"
        onClick={() => setShowCustomStatsEditor(false)}
      >
        <div
          className="custom-stats-editor"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="custom-stats-editor-header">
            <h2>Custom Stats - {selectedCharacter.name}</h2>
            <button
              onClick={() => setShowCustomStatsEditor(false)}
              className="close-button"
            >
              ×
            </button>
          </div>

          <div className="custom-stats-editor-content">
            {/* Create new stat */}
            <div className="create-stat-section">
              <h3>Create New Stat</h3>
              <div className="create-stat-form">
                <input
                  type="text"
                  placeholder="Stat name"
                  value={newStat.statname}
                  onChange={(e) =>
                    setNewStat((prev) => ({
                      ...prev,
                      statname: e.target.value,
                    }))
                  }
                  className="stat-name-input"
                />
                <select
                  value={newStat.type}
                  onChange={(e) =>
                    setNewStat((prev) => ({
                      ...prev,
                      type: e.target.value,
                    }))
                  }
                  className="stat-type-select"
                >
                  <option value="numeric">Numeric</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="text">Text</option>
                </select>

                {newStat.type === "numeric" && (
                  <input
                    type="number"
                    value={newStat.numericValue}
                    onChange={(e) =>
                      setNewStat((prev) => ({
                        ...prev,
                        numericValue: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="numeric-input"
                    min="0"
                  />
                )}

                {newStat.type === "checkbox" && (
                  <input
                    type="number"
                    value={newStat.checkboxCount}
                    onChange={(e) =>
                      setNewStat((prev) => ({
                        ...prev,
                        checkboxCount: Math.min(
                          10,
                          Math.max(1, parseInt(e.target.value) || 5)
                        ),
                      }))
                    }
                    className="checkbox-count-input"
                    min="1"
                    max="10"
                  />
                )}

                {newStat.type === "text" && (
                  <textarea
                    placeholder="Text content"
                    value={newStat.stat}
                    onChange={(e) =>
                      setNewStat((prev) => ({
                        ...prev,
                        stat: e.target.value,
                      }))
                    }
                    className="text-input"
                    rows="3"
                  />
                )}

                <button
                  onClick={handleCreateStat}
                  disabled={!newStat.statname.trim()}
                  className="create-stat-button"
                >
                  Create Stat
                </button>
              </div>
            </div>

            {/* Existing stats */}
            <div className="existing-stats-section">
              <h3>Existing Stats</h3>
              {customStats.length > 0 ? (
                <div className="existing-stats-list">
                  {customStats.map((stat) => (
                    <div
                      key={stat.id_customstat}
                      className="existing-stat-item"
                    >
                      {renderStatEditor(stat)}
                      {renderStatValue(stat)}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No custom stats created yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <InitiativeTracker refresh={initiativeRefresh} />
      <div className="grid-container" onWheel={handleWheel}>
        {/* Controls */}
        <div className="grid-controls">
          <div className="control-group">
            <label>Grid Size:</label>
            <input
              type="number"
              value={gridSize.width}
              onChange={(e) =>
                setGridSize((prev) => ({
                  ...prev,
                  width: parseInt(e.target.value) || 20,
                }))
              }
              min="5"
              max="100"
            />
            <span>×</span>
            <input
              type="number"
              value={gridSize.height}
              onChange={(e) =>
                setGridSize((prev) => ({
                  ...prev,
                  height: parseInt(e.target.value) || 15,
                }))
              }
              min="5"
              max="100"
            />
          </div>

          <div className="control-group">
            <label>Square Size:</label>
            <input
              type="number"
              value={squareSize}
              onChange={(e) => setSquareSize(parseInt(e.target.value) || 50)}
              min="20"
              max="200"
            />
            <span>px</span>
          </div>

          <div className="control-group">
            <label>Measurement:</label>
            <select
              value={measurementUnit}
              onChange={(e) => setMeasurementUnit(e.target.value)}
            >
              <option value="feet">Feet</option>
              <option value="meters">Meters</option>
            </select>
            <input
              type="number"
              value={unitSize}
              onChange={(e) => setUnitSize(parseFloat(e.target.value) || 5)}
              min="1"
              max="50"
            />
            <span>{measurementUnit === "feet" ? "ft" : "m"}</span>
          </div>

          <div className="control-group">
            <button
              className={`measurement-button ${
                measurementMode ? "active" : ""
              }`}
              onClick={() => {
                setMeasurementMode(!measurementMode);
                setMeasurementPoints([]);
                setSpellOrigin(null);
                setSpellShape("none");
              }}
            >
              📏 Measure
            </button>
            <button
              onClick={() => {
                setMeasurementPoints([]);
                setSpellOrigin(null);
                setSpellShape("none");
              }}
            >
              Clear
            </button>
          </div>

          {/* Character Management */}
          <div className="control-group">
            <button
              onClick={handleCreateCharacter}
              className="create-character-button"
            >
              ➕ Create Character
            </button>
          </div>

          {/* Spell Measurement Controls */}
          {measurementMode && (
            <>
              <div className="control-group">
                <label>Spell Shape:</label>
                <select
                  value={spellShape}
                  onChange={(e) => setSpellShape(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                  <option value="cone">Cone</option>
                  <option value="line">Line</option>
                </select>
              </div>

              <div className="control-group">
                <label>Range:</label>
                <input
                  type="number"
                  value={spellRange}
                  onChange={(e) =>
                    setSpellRange(parseInt(e.target.value) || 30)
                  }
                  min="5"
                  max="300"
                />
                <span>ft</span>
              </div>

              <div className="control-group">
                <label>Rotation:</label>
                <input
                  type="number"
                  value={spellRotation}
                  onChange={(e) =>
                    setSpellRotation(parseInt(e.target.value) || 0)
                  }
                  min="0"
                  max="359"
                />
                <span>°</span>
              </div>

              <div className="control-group">
                <small style={{ color: "var(--light-text)" }}>
                  Mouse wheel:{" "}
                  {measurementMode ? "Rotate spell" : "Adjust square size"}
                </small>
              </div>
            </>
          )}
        </div>

        {/* Measurement Display */}
        {measurementPoints.length === 2 && (
          <div className="measurement-display">
            <h3>Distance Measurement</h3>
            {(() => {
              const distance = calculateDistance(
                measurementPoints[0],
                measurementPoints[1]
              );
              return (
                <div>
                  <p>
                    <strong>Distance:</strong> {distance.squares} squares
                  </p>
                  <p>
                    <strong>Feet:</strong> {distance.feet} ft
                  </p>
                  <p>
                    <strong>Meters:</strong> {distance.meters} m
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Drag Distance Display */}
        {dragDistance && (
          <div className="drag-distance-display">
            <h3>Drag Distance</h3>
            <div>
              <p>
                <strong>Distance:</strong> {dragDistance.squares} squares
              </p>
              <p>
                <strong>Feet:</strong> {dragDistance.feet} ft
              </p>
              <p>
                <strong>Meters:</strong> {dragDistance.meters} m
              </p>
            </div>
          </div>
        )}

        {/* Grid with DnD Context */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[snapToGrid]}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div
            className="grid-area"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
          >
            <div
              className="grid"
              style={{ cursor: isDraggingGrid ? "grabbing" : "grab" }}
            >
              {renderGrid()}
              {renderTopNumbers()}
              {renderLeftLetters()}
              {renderMeasurementLine()}
              {renderSpellShape()}
              {renderMovementRange()}

              {/* Characters as draggable items */}
              <SortableContext
                items={characters.map((char) => char.id_entity.toString())}
                strategy={rectSortingStrategy}
              >
                {characters.map((character) => (
                  <DraggableCharacter
                    key={character.id_entity}
                    character={character}
                    squareSize={squareSize}
                    gridOffset={gridOffset}
                    onClick={handleCharacterClick}
                    measurementMode={measurementMode}
                  />
                ))}
              </SortableContext>
            </div>
          </div>

          {/* Drag Overlay - This ensures the dragged item follows the cursor exactly */}
          <DragOverlay>
            {activeCharacter ? (
              <div
                className="character-token dragging-overlay"
                style={{
                  width: activeCharacter.size * squareSize,
                  height: activeCharacter.size * squareSize,
                  opacity: 0.9,
                  cursor: "grabbing",
                  position: "fixed",
                  pointerEvents: "none",
                  zIndex: 10000,
                  transform: "none", // Ensure no transform interference
                }}
              >
                <div className="character-image">
                  {activeCharacter.image ? (
                    <img
                      src={activeCharacter.image}
                      alt={activeCharacter.name}
                    />
                  ) : (
                    <div className="character-placeholder">
                      {activeCharacter.name?.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Character Sheet Modal */}
        {showCharacterSheet && <CharacterSheet />}

        {/* Character Editor Modal */}
        <CharacterEditor
          isOpen={showCharacterEditor}
          onClose={() => setShowCharacterEditor(false)}
          character={editingCharacter}
          onSave={handleSaveCharacter}
        />

        {/* Custom Stats Editor Modal */}
        {showCustomStatsEditor && <CustomStatsEditor />}
      </div>
    </>
  );
};

export default Grid;
