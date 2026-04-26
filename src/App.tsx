import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-gray-800">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <Workspace sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    </div>
  );
}

export default App;
