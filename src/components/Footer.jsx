import React from "react";
import Section from "./Section";
import { FaTwitter, FaInstagram, FaGithub, FaLinkedin, FaYoutube, FaDribbble } from "react-icons/fa";

const socials = [
  { id: "twitter", icon: <FaTwitter />, url: "https://twitter.com/Akshat_35" },
  { id: "instagram", icon: <FaInstagram />, url: "https://instagram.com/Aksh8t" },
  { id: "github", icon: <FaGithub />, url: "https://github.com/Aksh8t" },
  { id: "linkedin", icon: <FaLinkedin />, url: "https://linkedin.com/in/Aksh8t" },
  { id: "youtube", icon: <FaYoutube />, url: "https://youtube.com/@Aksh8t" },
  { id: "dribbble", icon: <FaDribbble />, url: "https://dribbble.com/Aksh8t" },
];

const Footer = () => {
  return (
    <Section crosses className="!px-0 !py-10">
      <div className="container relative z-10 backdrop-blur-md bg-white/5 border border-white/10 shadow-md rounded-3xl px-6 py-10 flex flex-col sm:flex-row justify-between items-center gap-6 text-white">
        <p className="text-sm sm:text-base text-gray-400 text-center sm:text-left">
          © {new Date().getFullYear()}. All rights reserved. Built with 💻 by <span className="text-blue-400 font-semibold">Akshat Tiwari</span>
        </p>

        <ul className="flex gap-5 flex-wrap justify-center">
          {socials.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl p-3 rounded-full bg-white/10 hover:bg-blue-500 transition-colors duration-300 backdrop-blur-md border border-white/10 hover:scale-110 transform"
            >
              {item.icon}
            </a>
          ))}
        </ul>
      </div>
    </Section>
  );
};

export default Footer;
