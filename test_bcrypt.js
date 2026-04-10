const bcrypt = require('bcrypt');

async function testHash() {
    const password = 'admin123';
    const hash = '$2b$10$wTf26v9vE8.fO1KxkL8R.O.x/n9K1i3W5pW1N.qKxwQY8F.3I0E2m';
    const match = await bcrypt.compare(password, hash);
    console.log("Match string:", match);
    process.exit(0);
}

testHash();
