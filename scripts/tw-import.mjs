import("@tailwindcss/postcss")
  .then(() => console.log("ok"))
  .catch((e) => {
    console.error("fail", e);
    process.exit(1);
  });
