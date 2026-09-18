import { Outlet, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import ScrollReveal from './components/ScrollReveal'
import CinematicHome from './cinematic/CinematicHome'

import About from './pages/About'
import Classes from './pages/Classes'
import ClassPage from './pages/ClassPage'
import SubjectPage from './pages/SubjectPage'
import Subjects from './pages/Subjects'
import Notes from './pages/Notes'
import Solutions from './pages/Solutions'
import Questions from './pages/Questions'
import PreviousPapers from './pages/PreviousPapers'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import PaidNotes from './pages/PaidNotes'
import PaidNoteDetail from './pages/PaidNoteDetail'
import Bundles from './pages/Bundles'
import BundleDetail from './pages/BundleDetail'
import OnlineClasses from './pages/OnlineClasses'
import OnlineClassDetail from './pages/OnlineClassDetail'
import Neet from './pages/Neet'
import NeetCategory from './pages/NeetCategory'
import NeetNotes from './pages/NeetNotes'
import NeetQuestions from './pages/NeetQuestions'
import NeetPreviousQuestions from './pages/NeetPreviousQuestions'
import NeetRevision from './pages/NeetRevision'
import Calculators from './pages/Calculators'
import CalculatorDetail from './pages/CalculatorDetail'
import UnitConverter from './pages/UnitConverter'
import KdpCoverMaker from './pages/KdpCoverMaker'
import DpiIncreaser from './pages/DpiIncreaser'
import Resources from './pages/Resources'
import ResourceDetail from './pages/ResourceDetail'
import MockTests from './pages/MockTests'
import MockTestDetail from './pages/MockTestDetail'
import Contact from './pages/Contact'
import Dashboard from './pages/Dashboard'
import ScienceLanding from './pages/ScienceLanding'
import ScienceClassPage from './pages/ScienceClassPage'
import ScienceNoteDetail from './pages/ScienceNoteDetail'
import VirtualLabHub from './pages/VirtualLabHub'
import VirtualLabExperiment from './pages/VirtualLabExperiment'
import NotFound from './pages/NotFound'

/** Standard site chrome (header/footer) for every page except the cinematic home. */
function SiteLayout() {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <ScrollReveal />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-card-lg">
        Skip to content
      </a>
      <Routes>
        <Route path="/" element={<CinematicHome />} />

        <Route element={<SiteLayout />}>
          <Route path="/about" element={<About />} />

          {/* Science Notes System (Classes 6 to 12) */}
          <Route path="/learn" element={<ScienceLanding />} />
          <Route path="/learn/science" element={<ScienceLanding />} />
          <Route path="/learn/science/:classSlug" element={<ScienceClassPage />} />
          <Route path="/learn/science/:classSlug/:chapterSlug" element={<ScienceNoteDetail />} />
          <Route path="/learn/science/:classSlug/:subjectSlug/:chapterSlug" element={<ScienceNoteDetail />} />

          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/:classSlug" element={<ClassPage />} />
          <Route path="/classes/:classSlug/:subjectSlug" element={<SubjectPage />} />

          <Route path="/subjects" element={<Subjects />} />
          <Route path="/subjects/:subjectSlug" element={<SubjectPage />} />

          <Route path="/notes" element={<Notes />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/questions" element={<Questions />} />
          <Route path="/previous-papers" element={<PreviousPapers />} />

          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/paid-notes" element={<PaidNotes />} />
          <Route path="/paid-notes/:slug" element={<PaidNoteDetail />} />
          <Route path="/bundles" element={<Bundles />} />
          <Route path="/bundles/:slug" element={<BundleDetail />} />
          <Route path="/online-classes" element={<OnlineClasses />} />
          <Route path="/online-classes/:slug" element={<OnlineClassDetail />} />

          <Route path="/neet" element={<Neet />} />
          <Route path="/neet/botany" element={<NeetCategory kind="botany" />} />
          <Route path="/neet/zoology" element={<NeetCategory kind="zoology" />} />
          <Route path="/neet/notes" element={<NeetNotes />} />
          <Route path="/neet/questions" element={<NeetQuestions />} />
          <Route path="/neet/previous-questions" element={<NeetPreviousQuestions />} />
          <Route path="/neet/revision" element={<NeetRevision />} />

          <Route path="/calculators" element={<Calculators />} />
          <Route path="/calculators/converter" element={<UnitConverter />} />
          <Route path="/calculators/:slug" element={<CalculatorDetail />} />

          <Route path="/tools/kdp-cover-maker" element={<KdpCoverMaker />} />
          <Route path="/tools/dpi-increaser" element={<DpiIncreaser />} />

          {/* 3D Virtual Biology Lab */}
          <Route path="/virtual-lab" element={<VirtualLabHub />} />
          <Route path="/virtual-lab/:experimentId" element={<VirtualLabExperiment />} />

          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:slug" element={<ResourceDetail />} />

          <Route path="/mock-tests" element={<MockTests />} />
          <Route path="/mock-tests/:slug" element={<MockTestDetail />} />

          <Route path="/contact" element={<Contact />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </div>
  )
}
