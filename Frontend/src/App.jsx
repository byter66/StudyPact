import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing/Landing';
import Signin from './components/Signin/Signin';
import Signup from './components/Signup/Signup';
import Dashboard from './components/Dashboard/Dashboard';
import Studyroom from './components/Studyroom/Studyroom';
import Mockroom from './components/Mockroom/Mockroom';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import Doubtforum from './components/Doubtforum/Doubtforum';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/study-room/:roomId"
          element={
            <ProtectedRoute>
              <Studyroom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mock-room"
          element={
            <ProtectedRoute>
              <Mockroom />
            </ProtectedRoute>
          }
        />
        <Route path="/mock-room/:id" element={<Mockroom />} />
        <Route path="/doubt-forum/:id" element={<Doubtforum />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;