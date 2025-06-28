import React, { useState, useEffect } from "react";
import "./App.css";
import DiceRoller from "./DiceRoller";
import AudioPlayer from "./AudioPlayer";
import Grid from "./Grid";
import InitiativeTracker from "./InitiativeTracker";

import Login from "./Login";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check localStorage for user
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <div className="user-info">
        <span className="user-email">{user.name}</span>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
      <Grid />
      <AudioPlayer />
      <DiceRoller />
      <InitiativeTracker />
    </>
  );
}

export default App;
