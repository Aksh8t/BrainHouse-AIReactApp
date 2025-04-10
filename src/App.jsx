import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ButtonGradient from "./assets/svg/ButtonGradient";
import Benefits from "./components/Benefits";
import Collaboration from "./components/Collaboration";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Pricing from "./components/Pricing";
import Roadmap from "./components/Roadmap";
import Services from "./components/Services";
import Auth from "./components/Auth";
import Chatroom from "./components/Chatroom";
import PricingPage from "./components/PricingPage";

const App = () => {
  return (
    <Router>
      <div className="pt-[4.75rem] lg:pt-[5.25rem] overflow-hidden">
        <Header />
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Hero />
                <Benefits />
                <Collaboration />
                <Services />
                <Pricing />
                <Roadmap />
              </>
            }
          />
          <Route path="/sign-in" element={<Auth />} />
          <Route path="/sign-up" element={<Auth />} />
          <Route path="/chat" element={<Chatroom />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Routes>
        <Footer />
      </div>
      <ButtonGradient />
    </Router>
  );
};

export default App;
