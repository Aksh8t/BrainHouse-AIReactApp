"use client";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "./design/resizable-navbar.jsx";
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { brainwave } from "../assets";
import { navigation } from "../constants";
const Header = () => {
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const navItems = navigation.map((item) => ({
    name: item.title,
    link: item.url,
  }));

  return (
    <div
      className={`fixed top-0 left-0 w-full z-50 transition-transform duration-300 ${
        showNavbar ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <Navbar>
        <NavBody>
          {/* Logo */}
          <a href="/" className="w-[12rem]">
            <img src={brainwave} width={190} height={40} alt="Brainwave" />
          </a>

          {/* Desktop nav links */}
          <NavItems items={navItems} />

          {/* Auth / Buttons */}
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link
                to="/sign-up"
                className="text-sm text-neutral-500 hover:text-neutral-900"
              >
                New account
              </Link>
              <SignInButton mode="modal" redirectUrl="/">
                <NavbarButton variant="secondary">Sign in</NavbarButton>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </NavBody>

        {/* Mobile nav */}
        <MobileNav>
          <MobileNavHeader>
            <a href="/" className="w-[12rem]">
              <img src={brainwave} width={190} height={40} alt="Brainwave" />
            </a>
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-neutral-600 dark:text-neutral-300"
              >
                <span className="block">{item.name}</span>
              </a>
            ))}
            <div className="flex w-full flex-col gap-4">
              <SignedOut>
                <SignInButton mode="modal" redirectUrl="/">
                  <NavbarButton
                    variant="primary"
                    className="w-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign in
                  </NavbarButton>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <NavbarButton
                  variant="primary"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <UserButton afterSignOutUrl="/" />
                </NavbarButton>
              </SignedIn>

            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </div>
  );
};

export default Header;
