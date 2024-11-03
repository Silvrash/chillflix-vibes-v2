import { Colors } from "@/constants/Colors";
import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and do not have access to the DOM or browser APIs.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: ${Colors.dark.background};
  width: 100%;
}

#root {
  width: 100%;
}

input:focus-visible {
  outline: none
}

/* Container with content to scroll */
   

    /* Custom scrollbar styles */
   ::-webkit-scrollbar {
      width: 10px;
    }

   ::-webkit-scrollbar-track {
      background: #192e57; /* Track color */
      border-radius: 5px;
    }

   ::-webkit-scrollbar-thumb {
      background-color: #1f468e; /* Scroll bar color */
      border-radius: 5px;
    }

   ::-webkit-scrollbar-thumb:hover {
      background-color: #050a15; /* Hover color */
    }

.container {
  width: 100%;
  height: 100%;
  margin: 0 auto;
}
@media (min-width: 640px) {
  .container {
    max-width: 640px;
  }
}
@media (min-width: 768px) {
  .container {
    max-width: 768px;
  }
}
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }
}
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}
@media (min-width: 1536px) {
  .container {
    max-width: 1536px;
  }
}
  `;
