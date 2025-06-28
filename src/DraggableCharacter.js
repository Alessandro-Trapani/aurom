import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./DraggableCharacter.css";

const DraggableCharacter = ({
  character,
  squareSize,
  gridOffset,
  onClick,
  measurementMode,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: character.id_entity.toString(),
      transition: null,
    });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : "none",
    transition: "none",
    left: character.gridX * squareSize + gridOffset.x,
    top: character.gridY * squareSize + gridOffset.y,
    width: character.size * squareSize,
    height: character.size * squareSize,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : 1,
    cursor: isDragging ? "grabbing" : measurementMode ? "crosshair" : "grab",
    position: "absolute",
    pointerEvents: isDragging ? "none" : "auto",
    willChange: isDragging ? "transform" : "auto",
  };

  const handleMouseEnter = (e) => {
    if (!isDragging) {
      setShowTooltip(true);
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const handleMouseMove = (e) => {
    if (showTooltip) {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  };

  // Calculate HP percentage for the health bar
  const hpPercentage =
    character.maxhp > 0 ? (character.currenthp / character.maxhp) * 100 : 0;
  const hpColor =
    hpPercentage > 50 ? "#4CAF50" : hpPercentage > 25 ? "#FF9800" : "#F44336";

  // Don't render the original token when dragging - only show the overlay
  if (isDragging) return null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`character-token ${isDragging ? "dragging" : ""} ${
          measurementMode ? "measurement-mode" : ""
        }`}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) {
            onClick(character);
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="character-image">
          {character.image ? (
            <img src={character.image} alt={character.name} />
          ) : (
            <div className="character-placeholder">
              {character.name?.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Character Tooltip */}
      {showTooltip && !isDragging && (
        <div
          className="character-tooltip"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
          }}
        >
          <div className="tooltip-header">
            <h4>{character.name}</h4>
            <span className={`status-badge ${character.status?.toLowerCase()}`}>
              {character.status}
            </span>
          </div>

          <div className="tooltip-content">
            <div className="hp-bar-container">
              <div className="hp-label">
                HP: {character.currenthp}/{character.maxhp}
              </div>
              <div className="hp-bar">
                <div
                  className="hp-fill"
                  style={{
                    width: `${hpPercentage}%`,
                    backgroundColor: hpColor,
                  }}
                ></div>
              </div>
            </div>

            <div className="tooltip-stats">
              <div className="stat">
                <span className="stat-label">AC:</span>
                <span className="stat-value">{character.armorclass}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Speed:</span>
                <span className="stat-value">{character.speed} ft</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DraggableCharacter;
