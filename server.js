
const express = require('express')
const app = express()
var fs = require("fs");

app.get('/', function (req, res) {
    fs.readFile("index.html", function(err, data) {
        res.write(data);
        res.end();
    });
})

app.get('*', function (req, res) {
  res.send('Invalid URL')
})

app.listen(8081, function () {
  console.log('Example app listening on port 8081!')
})
