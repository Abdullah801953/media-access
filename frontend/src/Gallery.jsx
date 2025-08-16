import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.15, // each card after 0.15s
      delayChildren: 0.3, // wait before starting first card
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 120,
    },
  },
  hover: {
    y: -5,
    scale: 1.02,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

// Loading screen component
const LoadingScreen = () => (
  <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
    <div className="text-center">
      <div className="inline-block h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
      <h2 className="text-2xl font-light text-white">Loading Gallery</h2>
      <p className="text-gray-400 mt-2">Fetching your premium content...</p>
    </div>
  </div>
);

export default function DriveViewer() {
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiBase] = useState(
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://media-access.onrender.com"
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${apiBase}/api/drive-folder`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Server responded with ${response.status}`
          );
        }
        const data = await response.json();
        setFiles(data);
      } catch (err) {
        setError({
          message: err.message,
          details: "Please check console for more details",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiBase]);

  const getFileType = (file) => {
    if (file.mimeType) {
      if (file.mimeType.startsWith("image/")) return "image";
      if (file.mimeType.startsWith("video/")) return "video";
      if (file.mimeType === "application/vnd.google-apps.folder")
        return "folder";
    }
    return "file";
  };

  const renderFilePreview = (file) => {
    const type = getFileType(file);

    switch (type) {
      case "image":
        return (
          <img
            src={`${apiBase}/api/file/${file.id}/watermark`}
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        );
      case "video":
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video className="max-h-full max-w-full">
              <source
                src={`${apiBase}/api/file/${file.id}/watermark`}
                type={file.mimeType}
              />
            </video>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-16 h-16 text-white opacity-75"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>
        );
      case "folder":
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
            <svg
              className="w-16 h-16 text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="mt-2 text-sm text-gray-700 text-center">
              {file.name}
            </span>
          </div>
        );
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
            <svg
              className="w-16 h-16 text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="mt-2 text-sm text-gray-700 text-center">
              {file.name}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black relative">
      {/* Show loading screen while loading */}
      {loading && <LoadingScreen />}

      {/* Show error message if there's an error */}
      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center p-6 bg-white rounded-lg max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-800 mb-4">{error.message}</p>
            <p className="text-sm text-gray-600">{error.details}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {files.length === 0 && !loading ? (
          <motion.div
            className="text-center py-12 bg-white rounded-lg border border-gray-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              No files found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              The folder appears to be empty
            </p>
          </motion.div>
        ) : (
          <>
            <motion.div className="mb-8 text-center">
              <h2 className="text-3xl font-light text-white mb-2">
                CURATED SELECTION
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Premium quality media available for licensing or purchase
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {files.map((file) => (
                <motion.div
                  key={file.id}
                  className="bg-white rounded-none overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300"
                  variants={cardVariants}
                  whileHover="hover"
                >
                  <Link
                    to={
                      getFileType(file) === "folder"
                        ? `/folder/${file.id}`
                        : `/file-detail/${file.id}`
                    }
                    className="block group"
                  >
                    <div className="relative h-64 overflow-hidden">
                      {renderFilePreview(file)}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                        <span className="text-white text-sm font-medium truncate">
                          {file.name}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="p-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {file.name.split(".")[0]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(file.modifiedTime)}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between p-2 bg-gray-100 rounded">
                        <div>
                          <p className="text-xs font-medium">TYPE</p>
                          <p className="text-xs text-gray-500">
                            {getFileType(file).toUpperCase()}
                          </p>
                        </div>
                        <span className="text-sm font-bold">
                          {getFileType(file) === "folder" ? "VIEW" : "DOWNLOAD"}
                        </span>
                      </div>
                    </div>

                    <a
                      href={`/folder/${file.id}`} // dynamic folder link
                      rel="noopener noreferrer"
                    >
                      <button className="w-full py-3 bg-black text-white text-sm font-medium rounded-none hover:bg-gray-800 transition-colors uppercase tracking-wider">
                        {getFileType(file) === "folder" ? "OPEN" : "INQUIRE"}
                      </button>
                    </a>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
