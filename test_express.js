const express = require('express');
const ruleRoutes = require('./backend/src/routes/ruleRoutes');
const app = express();
app.use('/api/rules', ruleRoutes);

const server = app.listen(3000, async () => {
    try {
        const r = await fetch('http://localhost:3000/api/rules/my-rule');
        console.log("Status:", r.status);
        console.log("Body:", await r.text());
    } catch(e) { console.error(e) }
    server.close();
});
