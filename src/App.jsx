import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from './components/Navbar';

import VisualMemorySearch from "./components/VisualMemorySearch";
import LoginView from './components/login/LoginView';
import ProfileView from './components/login/ProfileView';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLoginSuccess = (data) => {
    setUser(data.user);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />

      <Routes>
        <Route path="/" element={<Navigate to="/visual-memory" replace />} />
        <Route path="/home" element={<Navigate to="/visual-memory" replace />} />

        <Route
          path="/login"
          element={!user ? <LoginView onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/visual-memory" replace />}
        />


        <Route path="/visual-memory" element={<VisualMemorySearch />} />

        <Route
          path="/profile"
          element={user ? <ProfileView user={user} /> : <Navigate to="/login" replace />}
        />

        <Route path="*" element={<Navigate to="/visual-memory" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
