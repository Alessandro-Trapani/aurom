import React, { useEffect, useState, useRef } from "react";
import "./DiceRoller.css";

// Import all dice images directly
import d4Image from "./assets/dices/d4.png";
import d6Image from "./assets/dices/d6.png";
import d8Image from "./assets/dices/d8.png";
import d10Image from "./assets/dices/d10.png";
import d12Image from "./assets/dices/d12.png";
import d20Image from "./assets/dices/d20.png";

// Create a mapping for easy access
const diceImageMap = {
  4: d4Image,
  6: d6Image,
  8: d8Image,
  10: d10Image,
  12: d12Image,
  20: d20Image,
};

const diceTypes = [4, 6, 8, 10, 12, 20];

const DiceRoller = () => {
  const [selectedDice, setSelectedDice] = useState([]);
  const [rolling, setRolling] = useState(false);
  const [visible, setVisible] = useState(false);
  const [finalValues, setFinalValues] = useState([]);
  const [total, setTotal] = useState(null);
  const [modifier, setModifier] = useState(0);
  const [modifierInput, setModifierInput] = useState("");
  // New state for animation trigger
  const [animateResult, setAnimateResult] = useState(false);

  // useRef to store the timeout ID
  const rollTimeoutRef = useRef(null);

  const addDice = (sides) => {
    setSelectedDice((prev) => [...prev, { sides }]);
  };

  const removeDice = (index) => {
    if (rolling) return;
    setSelectedDice((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
    setFinalValues((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const clearDice = () => {
    if (rolling) return;
    setSelectedDice([]);
    setFinalValues([]);
    setTotal(null);
    setModifier(0);
    setModifierInput("");
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    setRolling(false);
    setAnimateResult(false); // Reset animation state on clear
  };

  // Function to stop the roll and set final values
  const stopRoll = () => {
    setRolling(false);
    const newValues = selectedDice.map(
      (d) => Math.floor(Math.random() * d.sides) + 1
    );
    setFinalValues(newValues);
    const currentTotal = newValues.reduce((a, b) => a + b, 0);
    setTotal(currentTotal);

    // Trigger animation only for single d20 critical rolls
    if (selectedDice.length === 1 && selectedDice[0].sides === 20) {
      if (currentTotal === 20 || currentTotal === 1) {
        setAnimateResult(true);
        // Reset animation state after a short delay to allow re-triggering
        setTimeout(() => setAnimateResult(false), 500); // Should match CSS animation duration
      } else {
        setAnimateResult(false);
      }
    } else {
      setAnimateResult(false);
    }
  };

  const handleRoll = () => {
    if (selectedDice.length === 0) return;

    // Clear any existing timeout to reset the 1-second timer
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
    }

    setRolling(true);
    setFinalValues([]); // Clear final values at the start of a roll
    setAnimateResult(false); // Ensure animation is off when starting a new roll

    // Set a new timeout to stop the roll after 1 second
    rollTimeoutRef.current = setTimeout(() => {
      stopRoll();
      rollTimeoutRef.current = null; // Clear the ref after timeout
    }, 1000); // 1 second
  };

  const closeOverlay = () => {
    setVisible(false);
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    if (rolling) {
      stopRoll();
    }
    setAnimateResult(false); // Ensure animation is off when closing
  };

  const handleModifierInput = (value) => {
    if (value === "clear") {
      setModifierInput("");
      setModifier(0);
    } else {
      const newInput = modifierInput + value;
      setModifierInput(newInput);
      setModifier(parseInt(newInput) || 0);
    }
  };

  const finalTotal = (total || 0) + modifier;

  return (
    <>
      <button
        className="d20-fab"
        onClick={() => setVisible(true)}
        title="Open Dice Roller"
      >
        <img src={d20Image} alt="Open Dice Roller" className="dice-image " />
        <div className="number-overlay">{20}</div>
      </button>
      {visible && (
        <div className="overlay" onClick={closeOverlay}>
          <div
            className="dice-modal modal-top"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dice-selector">
              {diceTypes.map((sides) => (
                <div
                  key={sides}
                  className="dice-wrapper clickable"
                  onClick={() => addDice(sides)}
                >
                  <img
                    src={diceImageMap[sides]}
                    alt={`d${sides}`}
                    className="dice-image"
                  />
                  <div className="number-overlay">{sides}</div>
                </div>
              ))}
            </div>
            <div className="selected-dice grow-bottom">
              {selectedDice.map((dice, index) => (
                <div
                  key={index}
                  className="dice-wrapper clickable"
                  onClick={() => removeDice(index)}
                >
                  <RollingDie
                    sides={dice.sides}
                    rolling={rolling}
                    finalValue={finalValues[index]}
                    diceImageMap={diceImageMap}
                  />
                </div>
              ))}
            </div>
            <div className="actions">
              <button onClick={handleRoll}>Roll</button>
              <button onClick={clearDice}>Clear All</button>
            </div>
            {(() => {
              let rollColorClass = ""; // Use a class for colors
              let animationClass = ""; // Use a class for animation

              // Check for single d20 criticals
              if (selectedDice.length === 1 && selectedDice[0].sides === 20) {
                if (total === 20) {
                  // Check 'total' for the actual die result before modifier
                  rollColorClass = "gold-roll";
                  if (animateResult) animationClass = "grow-animation";
                } else if (total === 1) {
                  // Check 'total' for the actual die result before modifier
                  rollColorClass = "red-roll";
                  if (animateResult) animationClass = "grow-animation";
                }
              }

              return (
                <h3 className="total-display">
                  Total: {total == null ? 0 : total} + {modifier} ={" "}
                  <span className={`${rollColorClass} ${animationClass}`}>
                    {finalTotal}
                  </span>
                </h3>
              );
            })()}
            <div className="number-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                <button
                  key={num}
                  onClick={() => handleModifierInput(num.toString())}
                  disabled={rolling}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleModifierInput("clear")}
                disabled={rolling}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const RollingDie = ({ sides, rolling, finalValue, diceImageMap }) => {
  const [value, setValue] = useState("?");

  useEffect(() => {
    let interval;
    if (rolling) {
      interval = setInterval(() => {
        setValue(Math.floor(Math.random() * sides) + 1);
      }, 75);
    } else {
      if (finalValue !== undefined) {
        setValue(finalValue);
      } else {
        setValue("?");
      }
    }

    return () => {
      clearInterval(interval);
    };
  }, [rolling, sides, finalValue]);

  return (
    <div className="dice-wrapper">
      <img
        src={diceImageMap[sides]}
        alt={`d${sides}`}
        className={`dice-image ${rolling ? "spin" : ""}`}
      />
      <div className="number-overlay">{value}</div>
    </div>
  );
};

export default DiceRoller;
