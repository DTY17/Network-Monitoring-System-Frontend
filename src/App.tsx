import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from './auth/auth'
import './index.css'
import Dashboard from './dashboard/dashboard'

function App() {
  return (
    <div className='h-full w-full'>
      <BrowserRouter>
        <Routes>
          <Route path='/login' element={<Login/>}/>
          <Route path="/dashboard/*" element={<Dashboard/>}/>
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
