//==== Starting the Server
const {createServer} = require("http");  
const methods = Object.create(null);  
createServer((request, response) => {  
	// Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*'); // Allows any domain to access your server
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Adjust as necessary

    // Handle preflight requests for CORS
    if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
    }

	let handler = methods[request.method] || notAllowed;  
	handler(request)  
	.catch(error => {  
		if (error.status != null) return error;  
		return {body: String(error), status: 500};  
	})  
	.then(({body, status = 200, type = "text/plain"}) => {  
		response.writeHead(status, {"Content-Type": type});  
		if (body && body.pipe) body.pipe(response);  
		else response.end(body);  
	});
}).listen(8000);  
async function notAllowed(request) {  
	return {  
		status: 405,  
		body: `Method ${request.method} not allowed.`  
	};  
}

//=== Reading a File
// Parsing a URL
const {parse} = require("url");  
const {resolve, sep} = require("path");  
const baseDirectory = process.cwd();  
function urlPath(url) {  
	let {pathname} = parse(url);  
	let path = resolve(decodeURIComponent(pathname).slice(1));  
	if (path != baseDirectory && !path.startsWith(baseDirectory + sep)) 
	{  
		throw {status: 403, body: "Forbidden"};  
	}  
	return path;  
}

// GET Method
const {createReadStream} = require("fs");  
const {stat, readdir} = require("fs").promises;  
const mime = require("mime");
methods.GET = async function(request) {
	let path = urlPath(request.url);

    // Serve index.html for root
    if (path === baseDirectory || path === resolve(baseDirectory, 'index.html')) {
        path = resolve(baseDirectory, 'index.html'); // Ensure this points to your index.html file
    }

    let stats;
    try {
        stats = await stat(path);
    } catch (error) {
        if (error.code != "ENOENT") throw error;
        else return {status: 404, body: "File not found"};
    }
    if (stats.isDirectory()) {
        return {body: 'Directory access is forbidden', status: 403}; // Change to suit your needs
    } else {
        return {body: createReadStream(path), type: mime.getType(path)};
    }
};

//=== Deleting a File
const {rmdir, unlink} = require("fs").promises;  
methods.DELETE = async function(request) {  
	// translate the url into a file name  
	let path = urlPath(request.url);  
	// invoke stat object called stats  
	let stats;  
	// wait for stat to find the file  
	try {  
		stats = await stat(path);  
	// handle a non-existent file name  
	} catch (error) {  
		if (error.code != "ENOENT") throw error;  
		else return {status: 204};  
	}  
	// if the file name is a directory, remove it  
	if (stats.isDirectory()) await rmdir(path);  
	// if the file name is not a directory, remove it  
	else await unlink(path);  
	// report that the file deletion was successful  
	return {status: 204};  
};

//=== Writing a File
const {createWriteStream} = require("fs");  
function pipeStream(from, to) {  
	return new Promise((resolve, reject) => {  
		from.on("error", reject);  
		to.on("error", reject);  
		to.on("finish", resolve);  
		from.pipe(to);  
	});  
}  
methods.PUT = async function(request) {  
	let path = urlPath(request.url);  
	await pipeStream(request, createWriteStream(path));  
	return {status: 204};  
};