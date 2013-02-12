/*
Nathan's File System Functions:
Notes:
Everything uses errbacks.
*/
define(['underscore'], function(_){
    var sfsf = {
    /**
     * Takes any number of file path strings as arguments and joins them into one.
     * Trailing and leading slashes are added and removed as needed.
     **/
    joinPaths : function() {
        var result = arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            if (result[result.length - 1] !== '/') {
                result += '/';
            }
            if (arguments[i][0] === '/') {
                result += arguments[i].substr(1);
            } else {
                result += arguments[i];
            }
        }
        return result;
    },
    /**
     * Reads a directory and adds a metadata property to each entry
     * with the 
     **/
    readEntriesWithMetadata: function(dirEntry, callback){
        var directoryReader = dirEntry.createReader();
        directoryReader.readEntries(function(entries){
            var successCounter = _.after(entries.length, function(){
                callback(null, entries);
            });
            _.forEach(entries, function(entry){
                entry.getMetadata(function(metadata){
                    entry.metadata = metadata;
                    successCounter();
                }, callback);
            });
        }, callback);
    },
    /**
     * This will request the file system, but it will also wait for cordova to load
     * and request storage space if need be.
     */
    politelyRequestFileSystem : function(options, callback){
        if(_.isFunction(options)){
            callback = options;
        }
        function onReady(){
            var defaultOptions = {
                storageNeeded: 5*1024*1024, //5MB
                persistent: true
            };
            options = _.extend(defaultOptions, options || {});
            var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            var PERSISTENT = ("LocalFileSystem" in window) ?  window.LocalFileSystem.PERSISTENT : window.PERSISTENT;
            if(!requestFileSystem) {
                callback("Browser does not support filesystem API");
                return;
            }
            if("webkitStorageInfo" in window && "requestQuota" in window.webkitStorageInfo){
                //We're using chrome probably and need to request storage space.
                window.webkitStorageInfo.requestQuota(PERSISTENT, options.storageNeeded, function(grantedBytes) {
                    requestFileSystem(PERSISTENT, options.storageNeeded, function(fs){
                        callback(null, fs);
                    }, callback);
                }, callback);
            } else {
                requestFileSystem(PERSISTENT, options.storageNeeded, function(fs){
                    callback(null, fs);
                }, callback);
            }
        }
        if ('cordova' in window) {
            document.addEventListener("deviceready", onReady);
        }
        else {
            onReady();
        }
    },
    /**
     * Retrieve the file/directory and create it if it does not exist.
     * The file system is automatically requested with the default options.
     **/
    cretrieve : function(path, options, callback) {
        sfsf.politelyRequestFileSystem({}, function(error, fileSystem) {
            if(error){
                callback(error);
                return;
            }
            function justWrite(filePath, options, callback){
                fileSystem.root.getFile(filePath, {
                    create: true,
                    exclusive: false
                }, function(fileEntry) {
                    
                    // Create a FileWriter object for our FileEntry (log.txt).
                    fileEntry.createWriter(function(fileWriter) {
                        
                        fileWriter.onwriteend = function(e) {
                            callback(null, fileEntry)
                        };
                        
                        fileWriter.onerror = callback;
                        
                        // Blob() takes ArrayBufferView, not ArrayBuffer.
                        if (options.data.__proto__ == ArrayBuffer.prototype) {
                            options.data = new Uint8Array(options.data);
                        }
                        
                        var blob = new Blob([options.data], {type: options.type});
                        
                        //TODO: This might be broken in chromium.
                        fileWriter.write(blob);
                        
                    }, callback);
                
                }, callback);
            }
            console.log(fileSystem.name);
            console.log(fileSystem.root.name);
            var dirArray = path.split('/');
            var curPath = '';
            var getDirectoryHelper = function(dirEntry) {
                console.log(curPath);
                var pathSegment = dirArray.shift();
                if(_.isString(pathSegment)) {
                    curPath = sfsf.joinPaths(curPath, pathSegment);
                    if(dirArray.length === 0){
                        //This is the final segment
                        if(options.data){
                            //Data was included so assume were creating a file.
                            //TODO: Check that the directory doesn't exist.
                            justWrite(curPath, options, callback);
                            return;
                        }
                    }
                    fileSystem.root.getDirectory(curPath, {
                        create: (curPath.length > 1), //avoid creating the root dir.
                        exclusive: false
                    },
                    getDirectoryHelper,
                    callback);
                } else if(dirArray.length !== 0) {
                    callback("Error creating path: " + path);
                } else {
                    callback(null, dirEntry);
                }
            };
            getDirectoryHelper();
        });
    }
    //Add function readFilteredEntries(path, filter, callback)
    };
    return sfsf;
});