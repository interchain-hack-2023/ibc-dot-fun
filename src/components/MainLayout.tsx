"use client";

import { FC, PropsWithChildren } from "react";
import NavBar from "./NavBar";
import SkipBanner from "./SkipBanner";

const MainLayout: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div>
      <SkipBanner />
      <NavBar />
      <main className="px-4 pt-4 pb-24">
        <div className="w-full max-w-screen-xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;