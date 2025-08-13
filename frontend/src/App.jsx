import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Gallery from "./Gallery";
import ImageDetail from "./ImageDetail";
import FileTransfer from "./FileTransfer";
import Navbar from "./components/Navbar";

import "./App.css";
import FolderViewer from "./FolderViewer";

export default function App() {
  return (
    <Router>
      <div className=" bg-black text-white top-0 sticky z-50">
        <Navbar />
      </div>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/file-detail/:id" element={<ImageDetail />} />
        <Route path="/folder/:id" element={<FolderViewer />} />
        <Route path="/generate-token/:id" element={<FileTransfer />} />
      </Routes>
    </Router>
  );
}
