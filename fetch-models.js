const https = require('https');

https.get("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyBvCzGd9tp0jK-Mf1sBiNPPIHFXbMxyChw", (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.models) {
                json.models.forEach(m => console.log(m.name));
            } else {
                console.log(JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.log(data);
        }
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
