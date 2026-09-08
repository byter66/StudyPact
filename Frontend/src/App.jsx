import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing/Landing';
import Signin from './components/Signin/Signin';
import Signup from './components/Signup/Signup';
import Dashboard from './components/Dashboard/Dashboard';
import StudyRoom from './components/StudyRoom/StudyRoom';
import Mockroom from './components/Mockroom/Mockroom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/study-room/:id" element={<StudyRoom />} />
        <Route path="/mock-room" element={<Mockroom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;