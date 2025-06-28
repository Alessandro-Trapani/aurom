import React, { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "./supabaseClient";
import "./InitiativeTracker.css";

// Import the cross-swords image
import crossSwordsImage from "./assets/cross-swords.png";
import d20Image from "./assets/dices/d20.png";

const InitiativeTracker = ({ refresh }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [initiativeValues, setInitiativeValues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load characters from Supabase database
  const loadCharacters = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) {
        console.log("No user logged in");
        setCharacters([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("entity")
        .select("*")
        .eq("id_user", user.id_user)
        .order("name");

      if (error) {
        console.error("Error loading characters:", error);
        return;
      }

      console.log("InitiativeTracker loaded characters:", data);
      setCharacters(data || []);

      // Initialize initiative values from database or default to 0
      const initialInitiatives = {};
      data.forEach((char) => {
        // Use initiativescore from database if it exists, otherwise default to 0
        initialInitiatives[char.id_entity] = char.initiativescore || 0;
      });
      setInitiativeValues(initialInitiatives);
    } catch (error) {
      console.error("Failed to load characters:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Save initiative value to database
  const saveInitiativeToDatabase = async (characterId, initiativeValue) => {
    try {
      const { error } = await supabase
        .from("entity")
        .update({ initiativescore: initiativeValue })
        .eq("id_entity", characterId);

      if (error) {
        console.error("Error saving initiative to database:", error);
      } else {
        console.log(
          `Saved initiative ${initiativeValue} for character ${characterId}`
        );
      }
    } catch (error) {
      console.error("Failed to save initiative to database:", error);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, [refresh]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadCharacters();
  };

  const rollInitiative = async (characterId) => {
    const character = characters.find((char) => char.id_entity === characterId);
    if (!character) return;

    // Roll 1d20 + initiative bonus
    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const initiativeBonus = character.initiativebonus || 0;
    const totalInitiative = d20Roll + initiativeBonus;

    setInitiativeValues((prev) => ({
      ...prev,
      [characterId]: totalInitiative,
    }));

    // Save to database
    await saveInitiativeToDatabase(characterId, totalInitiative);

    console.log(
      `${character.name} rolled ${d20Roll} + ${initiativeBonus} = ${totalInitiative}`
    );
  };

  const rollAllInitiative = async () => {
    for (const char of characters) {
      await rollInitiative(char.id_entity);
    }
  };

  const handleInitiativeChange = (id, value) => {
    // Only update if the value is actually different
    const numValue = value === "" ? 0 : parseInt(value) || 0;
    setInitiativeValues((prev) => {
      if (prev[id] === numValue) return prev; // Don't update if same value
      return {
        ...prev,
        [id]: numValue,
      };
    });
  };

  const orderByInitiative = () => {
    const sorted = [...characters].sort((a, b) => {
      const initiativeDiff =
        initiativeValues[b.id_entity] - initiativeValues[a.id_entity];
      return initiativeDiff !== 0
        ? initiativeDiff
        : a.name.localeCompare(b.name);
    });
    setCharacters(sorted);
    setCurrentTurn(0);
  };

  const nextTurn = () => {
    if (characters.length > 0) {
      setCurrentTurn((prev) => (prev + 1) % characters.length);
    }
  };

  const resetTurns = async () => {
    const resetValues = {};
    for (const char of characters) {
      resetValues[char.id_entity] = 0;
      await saveInitiativeToDatabase(char.id_entity, 0);
    }
    setInitiativeValues(resetValues);
    setCurrentTurn(0);
  };

  // DnD Setup
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setCharacters((items) => {
        const oldIndex = items.findIndex(
          (item) => item.id_entity.toString() === active.id
        );
        const newIndex = items.findIndex(
          (item) => item.id_entity.toString() === over.id
        );

        // Update current turn position
        if (currentTurn === oldIndex) {
          setCurrentTurn(newIndex);
        } else if (currentTurn > oldIndex && currentTurn <= newIndex) {
          setCurrentTurn(currentTurn - 1);
        } else if (currentTurn < oldIndex && currentTurn >= newIndex) {
          setCurrentTurn(currentTurn + 1);
        }

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const SortableItem = ({ char, index }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: char.id_entity.toString() });
    const inputRef = useRef(null);
    const [localValue, setLocalValue] = useState(
      initiativeValues[char.id_entity] || ""
    );

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    // Update local value when initiativeValues changes
    useEffect(() => {
      setLocalValue(
        initiativeValues[char.id_entity] === 0
          ? ""
          : initiativeValues[char.id_entity] || ""
      );
    }, [initiativeValues[char.id_entity]]);

    const handleLocalChange = (value) => {
      setLocalValue(value);
      // Don't update global state while typing - only update local state
    };

    const handleLocalBlur = async () => {
      // Only update global state when user finishes typing
      const numValue = localValue === "" ? 0 : parseInt(localValue) || 0;
      setInitiativeValues((prev) => ({
        ...prev,
        [char.id_entity]: numValue,
      }));

      // Save to database
      await saveInitiativeToDatabase(char.id_entity, numValue);
    };

    // Get character image
    const getCharacterImage = (charId) => {
      try {
        return require(`./assets/characters/${charId.toLowerCase()}.jpg`);
      } catch (err) {
        return null;
      }
    };

    const characterImageUrl = getCharacterImage(char.id_entity);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`initiative-item ${
          index === currentTurn ? "current-turn" : ""
        }`}
      >
        <div className="item-content">
          <div className="drag-handle" {...attributes} {...listeners}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
            </svg>
          </div>

          <div className="character-image">
            {characterImageUrl ? (
              <img src={characterImageUrl} alt={char.name} />
            ) : (
              <div className="placeholder-image">?</div>
            )}
          </div>

          <div className="character-info">
            <div className="character-name">
              {index === currentTurn && (
                <span className="current-turn-indicator">→</span>
              )}
              {char.name}
            </div>
            <div className="character-bonus">+{char.initiativebonus || 0}</div>
          </div>

          <div className="initiative-controls">
            <button
              className="roll-initiative-btn"
              onClick={() => rollInitiative(char.id_entity)}
            >
              <img src={d20Image} alt="Roll d20" className="d20-icon" />
            </button>
            <input
              type="number"
              value={localValue}
              onChange={(e) => {
                const value = e.target.value;
                handleLocalChange(value);
              }}
              onBlur={handleLocalBlur}
              placeholder="0"
              className="initiative-input"
              ref={inputRef}
            />
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="loading-message">Loading initiative tracker...</div>;
  }

  return (
    <>
      <button className="initiative-fab" onClick={() => setIsOpen(!isOpen)}>
        <img src={crossSwordsImage} alt="Initiative Tracker" />
      </button>

      {isOpen && (
        <div className="initiative-modal">
          <div className="initiative-header">
            <h2>Initiative Tracker</h2>
            <div className="initiative-actions">
              <button onClick={rollAllInitiative} className="roll-all-btn">
                <img src={d20Image} alt="Roll All" className="d20-icon" />
                Roll All
              </button>
              <button onClick={orderByInitiative} className="order-btn">
                Order by Initiative
              </button>
              <button onClick={resetTurns} className="reset-btn">
                Reset Turns
              </button>
              <button onClick={nextTurn} className="next-turn-btn">
                Next Turn{" "}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                </svg>
              </button>
              <button
                onClick={handleManualRefresh}
                className={`refresh-btn ${isRefreshing ? "refreshing" : ""}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={characters.map((char) => char.id_entity.toString())}
            >
              <div className="initiative-list">
                {characters.map((char, index) => (
                  <SortableItem
                    key={char.id_entity}
                    char={char}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </>
  );
};

export default InitiativeTracker;
