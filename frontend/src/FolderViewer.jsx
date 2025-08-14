import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DriveViewer from "./Gallery";

export default function FolderViewer() {
  const { id } = useParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiBase] = useState(
    window.location.hostname === "localhost" ? "http://localhost:5000" : "https://media-access.onrender.com"
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${apiBase}/api/drive-folder/${id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server responded with ${response.status}`);
        }
        const data = await response.json();
        setFiles(data);
      } catch (err) {
        setError({ message: err.message, details: "Please check console for more details" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, apiBase]);

  if (loading) return <div>Loading folder contents...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <DriveViewer files={files} />;
}