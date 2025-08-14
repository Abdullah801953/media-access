import React from "react";
import Dashboard from "./Dashboard";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AdminSignInForm from "./AdminSignInForm";
import { AuthProvider, useAuth } from "../context/AuthContext"; // ✅ useAuth import

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  return isAuthenticated() ? children : <Navigate to="/signin" replace />;
};

const App = () => {
  return (
    <Router>
      <AuthProvider> {/* ✅ Router ke andar */}
        <Routes>
          <Route path="/signin" element={<AdminSignInForm />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
