import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import "./Login.css";

const Login = ({ onLoginSuccess }) => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Query the user_ table for a matching name and password
    const { data, error: queryError } = await supabase
      .from("user_")
      .select("*")
      .eq("name", name)
      .eq("password", password)
      .single();

    if (queryError || !data) {
      setError("Invalid name or password");
      setLoading(false);
      return;
    }

    // Store user info in localStorage for session persistence
    localStorage.setItem("user", JSON.stringify(data));
    onLoginSuccess(data);
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-modal">
        <h2 className="login-title">Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="login-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
