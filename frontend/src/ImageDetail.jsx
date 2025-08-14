import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ImageDetail() {
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  const { id } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [fileType, setFileType] = useState("image");
  const apiBase =
    window.location.hostname === "localhost" ? "http://localhost:5000" : "https://media-access.onrender.com";
  const watermarkedUrl = `${apiBase}/api/file/${id}/watermark`;
  const cleanUrl = `${apiBase}/api/download/${id}`;

  const handleVerifyToken = async () => {
    try {
      setLoading(true);
      setError(null);

      // Local decode without secret key
      let decoded;
      try {
        decoded = jwtDecode(token); // ✅ no secret needed
        if (!decoded) throw new Error("Invalid token format");
        if (new Date(decoded.expiresAt) < new Date()) {
          throw new Error("Token has expired");
        }
      } catch (localErr) {
        throw new Error(localErr.message);
      }

      // Server verification
      const response = await fetch(
        `${cleanUrl}?token=${encodeURIComponent(token)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Token verification failed");
      }

      setIsVerified(true);
    } catch (err) {
      setError(err.message);
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (withWatermark) => {
    const url = withWatermark ? watermarkedUrl : `${cleanUrl}?token=${token}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    const detectFileType = async () => {
      try {
        const response = await fetch(`${apiBase}/api/file-info/${id}`);
        const data = await response.json();
        setFileType(data.mimeType.startsWith("video/") ? "video" : "image");
      } catch (err) {
        console.error("Error detecting file type:", err);
      }
    };

    detectFileType();
  }, [id, apiBase]);

  return (
    <div className="min-h-screen bg-black">
      <main className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-none overflow-hidden mt-[12px]">
        <div className="relative">
          <img
            src={watermarkedUrl}
            alt="Selected"
            className="w-full max-h-[50vh] object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <p className="text-white text-xs font-medium">IMAGE ID: {id}</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <h2 className="text-lg font-light mb-3">LICENSE OPTIONS</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="border border-gray-200 p-3 hover:bg-gray-50 transition cursor-pointer">
              <h3 className="font-medium text-sm mb-1">WATERMARKED</h3>
              <p className="text-xs text-gray-600 mb-2">
                Preview with watermark
              </p>
              <button
                onClick={() => handleDownload(true)}
                className="w-full py-1.5 bg-black text-white text-xs font-medium rounded-none hover:bg-gray-800 transition-colors uppercase tracking-wider"
              >
                DOWNLOAD
              </button>
            </div>
            <div className="border border-gray-200 p-3 hover:bg-gray-50 transition cursor-pointer">
              <h3 className="font-medium text-sm mb-1">GENERATE YOUR TOKEN</h3>
              <p className="text-xs text-gray-600 mb-2">
                Access token for original version
              </p>
              <Link to={`/generate-token/${id}`}>
                <button className="w-full py-1.5 bg-black text-white text-xs font-medium rounded-none hover:bg-gray-800 transition-colors uppercase tracking-wider">
                  GENERATE
                </button>
              </Link>
            </div>

            <div className="border border-gray-200 p-3 hover:bg-gray-50 transition cursor-pointer">
              <h3 className="font-medium text-sm mb-1">HIGH RES</h3>
              <p className="text-xs text-gray-600 mb-2">Full quality version</p>
              <button
                onClick={() => handleDownload(false)}
                disabled={!isVerified}
                className={`w-full py-1.5 text-xs font-medium rounded-none uppercase tracking-wider ${
                  isVerified
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isVerified ? "DOWNLOAD CLEAN" : "VERIFY TOKEN FIRST"}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-medium text-sm mb-2">ENTER YOUR TOKEN</h3>
            {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
            {isVerified && (
              <div className="text-green-500 text-xs mb-2">
                Token verified! You can now download the clean version.
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                placeholder="Paste your token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 border border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
                disabled={isVerified}
              />
              <button
                onClick={handleVerifyToken}
                disabled={loading || isVerified}
                className={`py-2 px-4 text-xs font-medium rounded-none uppercase tracking-wider whitespace-nowrap ${
                  loading
                    ? "bg-gray-300 text-gray-500"
                    : isVerified
                    ? "bg-green-500 text-white"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {loading ? "VERIFYING..." : isVerified ? "VERIFIED" : "VERIFY"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
