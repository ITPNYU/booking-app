"use client";

import React from "react";

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error, reset }) => {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{error.message || "Something went wrong"}</i>
      </p>
      <button onClick={reset}>Try again</button>
    </div>
  );
};

export default ErrorPage;
