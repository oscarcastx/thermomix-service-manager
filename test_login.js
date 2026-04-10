async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'admin@thermomix.com', password: 'admin123' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Data:", data);
        process.exit(0);
    } catch(err) {
        console.error("Fetch error:", err.message);
        process.exit(1);
    }
}
run();
