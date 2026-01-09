// Job Hunt Vibe - Bookmarklet
// Drag this link to your bookmarks bar and click it on any job posting page
// to add the job to your tracker.

javascript: (function () {
    var apiUrl = 'http://localhost:3000/api/add-bookmark';  // Change this to your deployed URL

    var selectedText = window.getSelection().toString();

    var data = {
        title: document.title,
        url: window.location.href,
        selectedText: selectedText || document.body.innerText.substring(0, 3000),
        timestamp: new Date().toISOString()
    };

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(function (res) { return res.json(); })
        .then(function (result) {
            if (result.success) {
                alert('✓ Job added to Job Hunt Vibe!\n\n' + result.job.title + ' at ' + (result.job.company || 'Unknown'));
            } else {
                alert('Could not add job: ' + (result.error || 'Unknown error') + '\n\nReason: ' + (result.reason || ''));
            }
        })
        .catch(function (err) {
            alert('Error connecting to Job Hunt Vibe. Make sure the app is running.\n\n' + err.message);
        });
})();
