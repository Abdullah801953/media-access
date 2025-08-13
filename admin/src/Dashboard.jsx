import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedToken, setCopiedToken] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/users");
        const data = await response.json();
        setUsers(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const copyToken = (tokenObj) => {
    if (!tokenObj || !tokenObj.token) return;
    navigator.clipboard.writeText(tokenObj.token);
    setCopiedToken(tokenObj.token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to truncate long tokens
  const truncateToken = (tokenObj, length = 10) => {
    if (!tokenObj || !tokenObj.token) return "";
    const token = tokenObj.token;
    if (token.length <= length) return token;
    return `${token.slice(0, length)}...${token.slice(-length)}`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-black text-white">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            ADMIN PANEL
          </h1>
        </div>
        <nav className="p-4 space-y-2">
          <button className="w-full text-left px-4 py-2 bg-gray-900 rounded flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Users
          </button>
        </nav>
      </div>

      {/* Main content */}
      <div className="ml-64 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">User Management</h2>
          <button
            onClick={() => navigate(-1)}
            className="bg-black text-white px-4 py-2 rounded-none hover:bg-gray-800 transition"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Search and filter */}
        <div className="bg-white p-4 rounded-none shadow mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-black"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white rounded-none shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block h-8 w-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2">Loading users...</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Files
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {user.name || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      {user.tokens && user.tokens.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {user.tokens.map((tokenData, idx) => (
                            <div key={idx} className="relative group">
                              <div className="bg-gray-100 px-2 py-1 text-xs rounded font-mono truncate">
                                {truncateToken(tokenData)}
                                <div className="absolute bg-gray-200 bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded"></div>
                              </div>
                              {/* Full token tooltip */}
                              <div className="absolute z-10 hidden group-hover:block bottom-full mb-2 w-64 p-2 text-xs bg-black text-white rounded shadow-lg break-all">
                                {tokenData.token}
                              </div>
                              {copiedToken === tokenData.token && (
                                <span className="absolute -top-6 left-0 bg-black text-white text-xs px-2 py-1 rounded">
                                  Copied!
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No tokens</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.tokens && user.tokens.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {user.tokens.map((tokenData, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  tokenData.fileType === "image"
                                    ? "bg-blue-100 text-blue-800"
                                    : tokenData.fileType === "video"
                                    ? "bg-purple-100 text-purple-800"
                                    : tokenData.fileType === "folder"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {tokenData.fileType}
                              </span>
                              <span className="text-sm text-gray-600 truncate max-w-xs">
                                {tokenData.fileName}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No files</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.tokens && user.tokens.length > 0 ? (
                        <div className="flex flex-col space-y-2">
                          {user.tokens.map((tokenData, idx) => (
                            <button
                              key={idx}
                              onClick={() => copyToken(tokenData)}
                              className="bg-black text-white px-3 py-1 rounded text-sm hover:bg-gray-800 transition"
                            >
                              Copy Token
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          No tokens to copy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
