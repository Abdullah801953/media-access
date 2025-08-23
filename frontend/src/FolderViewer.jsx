import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { Copy, ChevronLeft, ChevronRight } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
    <div className="text-center">
      <div className="inline-block h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
      <h2 className="text-2xl font-light text-white">Loading Folder</h2>
      <p className="text-gray-400 mt-2">Fetching your content...</p>
    </div>
  </div>
);

const DownloadLoader = ({ progress, status }) => (
  <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
    <div className="text-center">
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            className="text-gray-700 stroke-current"
            strokeWidth="10"
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
          ></circle>
          <circle
            className="text-white stroke-current"
            strokeWidth="10"
            strokeLinecap="round"
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 - (progress * 251.2) / 100}
            transform="rotate(-90 50 50)"
          ></circle>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-lg font-medium">{progress}%</span>
        </div>
      </div>
      <h2 className="text-2xl font-light text-white">Preparing Download</h2>
      <p className="text-gray-400 mt-2">
        {status || "This may take a few moments..."}
      </p>
    </div>
  </div>
);
// Memoized file card component to prevent unnecessary re-renders
const FileCard = React.memo(({ file, apiBase, copyUrlToClipboard, getFileType, getFolderInfo, formatDate, formatFileSize }) => {
  const fileType = getFileType(file);
  const isMediaOrFolder = fileType === "image" || fileType === "video" || fileType === "folder";
  const folderInfo = fileType === "folder" ? getFolderInfo(file) : null;

  const renderFilePreview = useCallback(() => {
    switch (fileType) {
      case "image":
        return (
          <img
            src={`${apiBase}/api/file/${file.id}/watermark`}
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={e => {
              e.target.onerror = null;
              e.target.src = file.thumbnailLink || file.iconLink || "https://via.placeholder.com/300?text=Image+Not+Found";
            }}
          />
        );
      case "video":
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video 
              className="max-h-full max-w-full object-cover w-full h-full"
              muted
              preload="metadata"
              poster={`${apiBase}/api/file/${file.id}/thumbnail`}
            >
              <source
                src={`${apiBase}/api/file/${file.id}/watermark`}
                type={file.mimeType}
              />
              Your browser does not support the video tag.
            </video>
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
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
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-4">
            <svg
              className="w-16 h-16 text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
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
          </div>
        );
    }
  }, [file, apiBase, fileType]);

  return (
    <motion.div
      className="bg-white rounded-none overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300 relative"
      variants={cardVariants}
    >
      {/* Copy icon at top-left - Show for images, videos AND folders */}
      {isMediaOrFolder && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            copyUrlToClipboard(file);
          }}
          className="absolute top-2 left-2 z-10 bg-black/70 p-2 rounded-full text-white hover:bg-black transition-colors"
          title="Copy file URL"
        >
          <Copy size={16} />
        </button>
      )}

      <Link
        to={
          fileType === "folder"
            ? `/folder/${file.id}`
            : `/file-detail/${file.id}`
        }
        className="block group"
      >
        <div className="relative h-64 overflow-hidden">
          {renderFilePreview()}
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
                {fileType.toUpperCase()}
              </p>
            </div>
            <span className="text-sm font-bold">
              {fileType === "image" || fileType === "video"
                ? formatFileSize(file.size)
                : fileType === "folder"
                }
            </span>
          </div>
          
          {/* Additional info row for folders */}
         
        </div>

        <button className="w-full py-3 bg-black text-white text-sm font-medium rounded-none hover:bg-gray-800 transition-colors uppercase tracking-wider">
          {fileType === "folder" ? "OPEN" : "INQUIRE"}
        </button>
      </div>
    </motion.div>
  );
});

FileCard.displayName = 'FileCard';

// Pagination component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pages = useMemo(() => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return pageNumbers;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center mt-8 space-x-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`p-2 rounded ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-white hover:bg-gray-700'}`}
      >
        <ChevronLeft size={20} />
      </button>
      
      {pages[0] > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-blue-600 text-white' : 'text-white hover:bg-gray-700'}`}
          >
            1
          </button>
          {pages[0] > 2 && <span className="text-white">...</span>}
        </>
      )}
      
      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1 rounded ${currentPage === page ? 'bg-blue-600 text-white' : 'text-white hover:bg-gray-700'}`}
        >
          {page}
        </button>
      ))}
      
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="text-white">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-blue-600 text-white' : 'text-white hover:bg-gray-700'}`}
          >
            {totalPages}
          </button>
        </>
      )}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`p-2 rounded ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-white hover:bg-gray-700'}`}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default function FolderViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12); // Adjust based on your layout

  const apiBase = useMemo(() => 
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://api.oneshootproduction.in",
    []
  );

  const cleanUrl = useMemo(() => `${apiBase}/api/verify-folder-token`, [apiBase]);

  // Memoized functions to prevent unnecessary re-renders
  const formatDate = useCallback((dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  const formatFileSize = useCallback((bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }, []);

  const getFileType = useCallback((file) => {
    if (file.mimeType) {
      if (file.mimeType.startsWith("image/")) return "image";
      if (file.mimeType.startsWith("video/")) return "video";
      if (file.mimeType === "application/vnd.google-apps.folder") return "folder";
    }
    return "file";
  }, []);

  const copyUrlToClipboard = useCallback((file) => {
    const baseUrl = window.location.origin;
    const fileType = getFileType(file);

    let url;
    if (fileType === "folder") {
      url = `${baseUrl}/folder/${file.id}`;
    } else {
      url = `${baseUrl}/file-detail/${file.id}`;
    }

    navigator.clipboard.writeText(url)
      .then(() => {
        console.log("URL copied to clipboard:", url);
      })
      .catch((err) => {
        console.error("Failed to copy URL:", err);
      });
  }, [getFileType]);

  const getFolderInfo = useCallback((folder) => {
    const filesInFolder = files.filter(f => f.parents && f.parents.includes(folder.id));
    const imageCount = filesInFolder.filter(f => getFileType(f) === "image").length;
    const videoCount = filesInFolder.filter(f => getFileType(f) === "video").length;
    
    return {
      totalFiles: filesInFolder.length,
      imageCount,
      videoCount
    };
  }, [files, getFileType]);

  // Function to check if a folder contains images or videos
  const checkFolderForMedia = useCallback(async (folderId) => {
    try {
      const response = await fetch(`${apiBase}/api/drive-folder/${folderId}`);
      if (!response.ok) return false;

      const folderData = await response.json();
      return folderData.some(
        (file) =>
          file.mimeType.startsWith("image/") ||
          file.mimeType.startsWith("video/")
      );
    } catch (error) {
      console.error("Error checking folder:", error);
      return false;
    }
  }, [apiBase]);

  const handleVerifyToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Local decode without secret key
      const decoded = jwtDecode(token);
      if (!decoded) throw new Error("Invalid token format");
      if (new Date(decoded.exp * 1000) < new Date()) {
        throw new Error("Token has expired");
      }

      // Server verification
      const response = await fetch(cleanUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, fileId: id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Token verification failed");
      }

      const data = await response.json();
      if (!data.valid) {
        throw new Error("Token is not valid for this folder");
      }

      setIsVerified(true);
      setError(null);
    } catch (err) {
      setError({ message: err.message });
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  }, [token, cleanUrl, id]);

  const downloadFolderAsZip = useCallback((withWatermark = true) => {
    let endpoint = withWatermark
      ? `${apiBase}/api/folder/${id}/watermark-zip`
      : `${apiBase}/api/folder/${id}/clean-zip`;

    if (!withWatermark) {
      endpoint += `?token=${encodeURIComponent(token)}`;
    }

    // direct browser download trigger
    const link = document.createElement("a");
    link.href = endpoint;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [apiBase, id, token]);

  // Calculate paginated files
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredFiles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredFiles, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => 
    Math.ceil(filteredFiles.length / itemsPerPage),
    [filteredFiles.length, itemsPerPage]
  );

  // Reset to first page when filtered files change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredFiles]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${apiBase}/api/drive-folder/${id}`);
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
  }, [id, apiBase]);

  // Filter files to only show images, videos, and folders that contain media
  useEffect(() => {
    const filterFiles = async () => {
      if (files.length === 0) {
        setFilteredFiles([]);
        return;
      }

      const filtered = [];

      for (const file of files) {
        const type = getFileType(file);

        // Always include images and videos
        if (type === "image" || type === "video") {
          filtered.push(file);
        }
        // For folders, check if they contain images or videos
        else if (type === "folder") {
          const hasMedia = await checkFolderForMedia(file.id);
          if (hasMedia) {
            filtered.push(file);
          }
        }
      }

      setFilteredFiles(filtered);
    };

    filterFiles();
  }, [files, getFileType, checkFolderForMedia]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-black relative">
      {loading && <LoadingScreen />}
      {downloadLoading && (
        <DownloadLoader progress={downloadProgress} status={downloadStatus} />
      )}

      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center p-6 bg-white rounded-lg max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-800 mb-4">{error.message}</p>
            {error.details && (
              <p className="text-sm text-gray-600 mb-4">{error.details}</p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
              >
                Try Again
              </button>
              <button
                onClick={() => setError(null)}
                className="mt-4 px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {filteredFiles.length === 0 && loading ? (
          <div className="text-center py-20">
            <div className="inline-block h-16 w-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-2xl font-light text-white">Loading Folder Contents</h2>
            <p className="text-gray-400 mt-2">Please wait while we fetch your files...</p>
          </div>
        ) : filteredFiles.length === 0 && !loading ? (
          <div className="text-center py-20">
            <div className="inline-block h-16 w-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-2xl font-light text-white">Loading Folder Contents</h2>
            <p className="text-gray-400 mt-2">Please wait while we fetch your files...</p>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center px-2">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                {/* Back Button */}
                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 text-white hover:bg-gray-800 rounded-none bg-gray-300 text-sm cursor-pointer w-full md:w-auto"
                >
                  Back
                </button>

                {/* Heading */}
                <h2 className="text-2xl md:text-3xl font-light text-white mb-2 md:mb-0">
                  FOLDER CONTENT
                </h2>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <button
                    onClick={() => downloadFolderAsZip(true)}
                    disabled={filteredFiles.length === 0 || downloadLoading}
                    className={`px-4 py-2 rounded-none text-sm font-medium w-full sm:w-auto ${
                      filteredFiles.length === 0 || downloadLoading
                        ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {downloadLoading
                      ? "PREPARING..."
                      : "Download with Watermark"}
                  </button>

                  <button
                    onClick={() => downloadFolderAsZip(false)}
                    disabled={downloadLoading || !isVerified}
                    className={`px-4 py-2 rounded-none text-sm font-medium w-full sm:w-auto ${
                      downloadLoading || !isVerified
                        ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {downloadLoading
                      ? "PREPARING..."
                      : isVerified
                      ? "Download Clean"
                      : "Verify Token First"}
                  </button>

                  <Link
                    to={`/folder-generate-token/${id}`}
                    className="w-full sm:w-auto"
                  >
                    <button className="px-4 py-2 bg-gray-300 text-black text-sm font-medium rounded-none hover:bg-gray-400 transition-colors w-full sm:w-auto">
                      GET TOKEN
                    </button>
                  </Link>
                </div>
              </div>

              <p className="text-gray-400 max-w-2xl mx-auto">
                Showing {paginatedFiles.length} of {filteredFiles.length} media items (Page {currentPage} of {totalPages})
              </p>

              {/* Token Verification Section */}
              <div className="mt-4 bg-white p-4 max-w-md mx-auto rounded-md">
                <h3 className="font-medium text-sm mb-2">
                  VERIFY YOUR TOKEN TO GET WITHOUT WATERMARK FILE
                </h3>

                {error && (
                  <div className="text-red-500 text-xs mb-2">
                    {error.message}
                  </div>
                )}
                {isVerified && (
                  <div className="text-green-500 text-xs mb-2">
                    Token verified! You can download clean files.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Paste your access token here"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="flex-1 border border-gray-300 p-2 text-xs focus:outline-none focus:border-black w-full"
                    disabled={isVerified || loading}
                  />
                  <button
                    onClick={handleVerifyToken}
                    disabled={loading || isVerified}
                    className={`py-2 px-4 text-xs font-medium rounded-none uppercase tracking-wider whitespace-nowrap w-full sm:w-auto ${
                      loading
                        ? "bg-gray-300 text-gray-500"
                        : isVerified
                        ? "bg-green-500 text-white"
                        : "bg-black text-white hover:bg-gray-800"
                    }`}
                  >
                    {loading
                      ? "VERIFYING..."
                      : isVerified
                      ? "VERIFIED"
                      : "VERIFY"}
                  </button>
                </div>
              </div>
            </div>

            <motion.div
              className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {paginatedFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  apiBase={apiBase}
                  copyUrlToClipboard={copyUrlToClipboard}
                  getFileType={getFileType}
                  getFolderInfo={getFolderInfo}
                  formatDate={formatDate}
                  formatFileSize={formatFileSize}
                />
              ))}
            </motion.div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </main>
    </div>
  );
}