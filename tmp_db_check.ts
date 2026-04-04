async function run() {
  const res = await fetch("https://aladdin-testing.vercel.app/api/cron/tick", {
    method: "POST",
    headers: {
      "Authorization": "Bearer dev-secret",
      "Content-Type": "application/json"
    }
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
run();
