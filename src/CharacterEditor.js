import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./CharacterEditor.css";

const CharacterEditor = ({ isOpen, onClose, character = null, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    level: 10,
    positionx: 0,
    positiony: 0,
    armorclass: 15,
    maxhp: 65,
    currenthp: 65,
    speed: 30,
    notes: "",
    image: "",
    ismain: false,
    inbench: false,
    initiativebonus: 2,
    initiativescore: 0,
    strength: 14,
    dexterity: 14,
    intelligence: 12,
    wisdom: 12,
    charisma: 10,
    status: "Alive",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Load character data when editing
  useEffect(() => {
    if (!isOpen) return;

    if (character) {
      setFormData({
        name: character.name || "",
        level: character.level || 10,
        positionx: character.positionx || 0,
        positiony: character.positiony || 0,
        armorclass: character.armorclass || 15,
        maxhp: character.maxhp || 65,
        currenthp: character.currenthp || 65,
        speed: character.speed || 30,
        notes: character.notes || "",
        image: character.image || "",
        ismain: character.ismain || false,
        inbench: character.inbench || false,
        initiativebonus: character.initiativebonus || 2,
        initiativescore: character.initiativescore || 0,
        strength: character.strength || 14,
        dexterity: character.dexterity || 14,
        intelligence: character.intelligence || 12,
        wisdom: character.wisdom || 12,
        charisma: character.charisma || 10,
        status: character.status || "Alive",
      });

      // Set image preview if character has an image
      if (character.image) {
        setImagePreview(character.image);
      } else {
        setImagePreview("");
      }
      setSelectedFile(null);
    } else {
      // Reset to defaults for new character
      setFormData({
        name: "",
        level: 10,
        positionx: 0,
        positiony: 0,
        armorclass: 15,
        maxhp: 65,
        currenthp: 65,
        speed: 30,
        notes: "",
        image: "",
        ismain: false,
        inbench: false,
        initiativebonus: 2,
        initiativescore: 0,
        strength: 14,
        dexterity: 14,
        intelligence: 12,
        wisdom: 12,
        charisma: 10,
        status: "Alive",
      });
      setImagePreview("");
      setSelectedFile(null);
    }
  }, [isOpen, character?.id_entity]);

  // Calculate ability modifiers
  const getAbilityModifier = (score) => {
    return Math.floor((score - 10) / 2);
  };

  // Calculate derived stats
  const calculateDerivedStats = useCallback(() => {
    const dexMod = getAbilityModifier(formData.dexterity);

    // Initiative = Dexterity modifier (but allow manual override)
    const calculatedInitiative = dexMod;

    // HP calculation (simplified for level 10, using default constitution)
    const defaultConMod = 2; // Default constitution modifier
    const baseHP = 8; // Assuming d8 hit die
    const calculatedMaxHP = baseHP + defaultConMod * 10 + defaultConMod * 9; // Level 1 + 9 levels

    return {
      initiativebonus: calculatedInitiative,
      initiativescore: calculatedInitiative + 10, // Initiative score = modifier + 10
      maxhp: Math.max(1, calculatedMaxHP),
      currenthp: Math.max(1, calculatedMaxHP),
    };
  }, [formData.dexterity]);

  // Update derived stats when ability scores change (but allow manual override)
  useEffect(() => {
    const derived = calculateDerivedStats();
    setFormData((prev) => ({
      ...prev,
      maxhp: derived.maxhp,
      currenthp: derived.currenthp,
    }));
  }, [calculateDerivedStats, formData.dexterity]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberInputChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file size must be less than 5MB");
        return;
      }

      setSelectedFile(file);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedFile(null);
    setImagePreview("");
    setFormData((prev) => ({
      ...prev,
      image: "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) {
        throw new Error("User not logged in");
      }

      let imagePath = formData.image;

      // Handle file upload if a new file was selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append("image", selectedFile);

        const uploadResponse = await fetch(
          "http://localhost:3001/upload-character-image",
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const uploadResult = await uploadResponse.json();
        imagePath = uploadResult.filePath;
      }

      const characterData = {
        ...formData,
        image: imagePath,
        id_user: user.id_user,
      };

      console.log("Saving character data:", characterData);
      console.log("Position values:", {
        positionx: characterData.positionx,
        positiony: characterData.positiony,
      });

      let result;
      if (character) {
        // Update existing character
        const { data, error } = await supabase
          .from("entity")
          .update(characterData)
          .eq("id_entity", character.id_entity)
          .select();

        if (error) throw error;
        result = data[0];
        console.log("Updated character result:", result);
      } else {
        // Create new character
        const { data, error } = await supabase
          .from("entity")
          .insert(characterData)
          .select();

        if (error) throw error;
        result = data[0];
        console.log("Created character result:", result);
      }

      onSave(result);
      onClose();
    } catch (error) {
      console.error("Error saving character:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="character-editor-overlay" onClick={onClose}>
      <div className="character-editor" onClick={(e) => e.stopPropagation()}>
        <div className="character-editor-header">
          <h2>{character ? "Edit Character" : "Create New Character"}</h2>
          <button onClick={onClose} className="close-button">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="character-editor-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Character name"
                />
              </div>
              <div className="form-group">
                <label>Level:</label>
                <input
                  type="number"
                  name="level"
                  value={formData.level}
                  onChange={handleNumberInputChange}
                  min="1"
                  max="20"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Status:</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="Alive">Alive</option>
                  <option value="Stunned">Stunned</option>
                  <option value="Poisoned">Poisoned</option>
                  <option value="Unconscious">Unconscious</option>
                  <option value="Blinded">Blinded</option>
                  <option value="Charmed">Charmed</option>
                  <option value="Deafened">Deafened</option>
                  <option value="Frightened">Frightened</option>
                  <option value="Grappled">Grappled</option>
                  <option value="Incapacitated">Incapacitated</option>
                  <option value="Invisible">Invisible</option>
                  <option value="Paralyzed">Paralyzed</option>
                  <option value="Petrified">Petrified</option>
                  <option value="Prone">Prone</option>
                  <option value="Restrained">Restrained</option>
                  <option value="Exhausted">Exhausted</option>
                  <option value="Dead">Dead</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Character Image:</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="file-input"
                    id="character-image"
                  />
                  <label htmlFor="character-image" className="file-input-label">
                    {selectedFile ? selectedFile.name : "Choose an image file"}
                  </label>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="remove-image-btn"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Character preview" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Combat Stats</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Armor Class:</label>
                <input
                  type="number"
                  name="armorclass"
                  value={formData.armorclass}
                  onChange={handleNumberInputChange}
                  min="0"
                  max="30"
                />
              </div>
              <div className="form-group">
                <label>Max HP:</label>
                <input
                  type="number"
                  name="maxhp"
                  value={formData.maxhp}
                  onChange={handleNumberInputChange}
                  min="1"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Current HP:</label>
                <input
                  type="number"
                  name="currenthp"
                  value={formData.currenthp}
                  onChange={handleNumberInputChange}
                  min="0"
                  max={formData.maxhp}
                />
              </div>
              <div className="form-group">
                <label>Speed (ft):</label>
                <input
                  type="number"
                  name="speed"
                  value={formData.speed}
                  onChange={handleNumberInputChange}
                  min="0"
                  max="200"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Initiative Bonus:</label>
                <input
                  type="number"
                  name="initiativebonus"
                  value={formData.initiativebonus}
                  onChange={handleNumberInputChange}
                  min="-10"
                  max="20"
                />
                <small>
                  Calculated from Dexterity:{" "}
                  {getAbilityModifier(formData.dexterity)}
                </small>
              </div>
              <div className="form-group">
                <label>Initiative Score:</label>
                <input
                  type="number"
                  name="initiativescore"
                  value={formData.initiativescore}
                  onChange={handleNumberInputChange}
                  min="0"
                  max="30"
                />
                <small>Calculated from Initiative Bonus</small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Ability Scores</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Strength:</label>
                <input
                  type="number"
                  name="strength"
                  value={formData.strength}
                  onChange={handleNumberInputChange}
                  min="1"
                  max="30"
                />
                <small>
                  Modifier:{" "}
                  {getAbilityModifier(formData.strength) >= 0 ? "+" : ""}
                  {getAbilityModifier(formData.strength)}
                </small>
              </div>
              <div className="form-group">
                <label>Dexterity:</label>
                <input
                  type="number"
                  name="dexterity"
                  value={formData.dexterity}
                  onChange={handleNumberInputChange}
                  min="1"
                  max="30"
                />
                <small>
                  Modifier:{" "}
                  {getAbilityModifier(formData.dexterity) >= 0 ? "+" : ""}
                  {getAbilityModifier(formData.dexterity)}
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Intelligence:</label>
                <input
                  type="number"
                  name="intelligence"
                  value={formData.intelligence}
                  onChange={handleNumberInputChange}
                  min="1"
                  max="30"
                />
                <small>
                  Modifier:{" "}
                  {getAbilityModifier(formData.intelligence) >= 0 ? "+" : ""}
                  {getAbilityModifier(formData.intelligence)}
                </small>
              </div>
              <div className="form-group">
                <label>Wisdom:</label>
                <input
                  type="number"
                  name="wisdom"
                  value={formData.wisdom}
                  onChange={handleNumberInputChange}
                  min="1"
                  max="30"
                />
                <small>
                  Modifier:{" "}
                  {getAbilityModifier(formData.wisdom) >= 0 ? "+" : ""}
                  {getAbilityModifier(formData.wisdom)}
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Charisma:</label>
                <input
                  type="number"
                  name="charisma"
                  value={formData.charisma}
                  onChange={handleNumberInputChange}
                  min="1"
                  max="30"
                />
                <small>
                  Modifier:{" "}
                  {getAbilityModifier(formData.charisma) >= 0 ? "+" : ""}
                  {getAbilityModifier(formData.charisma)}
                </small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Notes</h3>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Notes:</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Enter character notes, background, or other details..."
                  rows="4"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : character
                ? "Update Character"
                : "Create Character"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CharacterEditor;
