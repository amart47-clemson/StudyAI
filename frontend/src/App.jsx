import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DocumentProvider } from './context/DocumentContext'
import StudyPage from './pages/StudyPage'
import UploadPage from './pages/UploadPage'

export default function App() {
  return (
    <DocumentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/study/:docId" element={<StudyPage />} />
        </Routes>
      </BrowserRouter>
    </DocumentProvider>
  )
}
