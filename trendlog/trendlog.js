module.exports = function(RED) {

    function Trendlog(config) {
        RED.nodes.createNode(this,config);
        this.name = config.name;
        this.trendlogsetup = RED.nodes.getNode(config.trendlogsetup);
        this.devicesetup = RED.nodes.getNode(config.devicesetup);
        var node = this;

        /**Required moduels**/
        const https = require('https');
        const http = require('http');

        /**CONFIG variables**/
        var apiKey_config = this.trendlogsetup.apiKey;
        var deviceID_config = config.enableprefix!==undefined&&config.enableprefix?this.devicesetup.deviceID+"_":"";
        var host_config = this.trendlogsetup.trendloghost;
        var datalocation_config = this.trendlogsetup.datalocation;
        var name_config = this.trendlogsetup.name;
        var prefix_config = this.trendlogsetup.prefix;
        /********************/
       
        /**Trendlog related variables**/
        var minPostInterval = 30; //sec
        var trendlogHost = "api.trendlog.io";
        var trendlogPath = `/V1/channels/update/${apiKey_config}`;
        var trendlogPort = 443;
        if(datalocation_config == "trendlogio") {
            trendlogPath = `/V1/channels/update/${apiKey_config}`;
            minPostInterval = 30; //sec
        }
        else if(datalocation_config == "trendlogiolive") 
        {
            trendlogPath = `/V1/channels/live/${apiKey_config}`;
            minPostInterval = 1; //sec
        }
        else {
            trendlogHost = host_config;
            console.log(host_config);
            trendlogPath = `/api/V1/channels/update/${apiKey_config}`+(prefix_config!=undefined&&prefix_config!=""?`?prefix=`+prefix_config:``);
//            trendlogPath = `/V1/channels/update/${apiKey_config}`+(prefix_config!=undefined&&prefix_config!=""?`?prefix=`+prefix_config:``);
            trendlogPort = 80;
        }
        var timestamp;
        var value;

        /*****************************/
        var busyFlag = 0;
        var maxPostSize = 10;
        var lastPostTime = Date.now();
        /**
        * Trendlog related functions
        */
        function trendlogPostData(toTrendlog) {
            
            //if(busyFlag != 0 || lastPostTime+(minPostInterval*1000) > Date.now()) {
                // save data to local storage
            //    return;
            //}
            busyFlag = 1;            

            //Setup HTTPS request options.
            var options = {
                hostname: trendlogHost,
                port: trendlogPort,
                path: trendlogPath,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': JSON.stringify(toTrendlog).length
                }
            }
            lastPostTime = Date.now();
            // console.log(options);

            //Post toTrendlog
            var req = null;
            if(trendlogPort==80)
            {
                req = http.request(options, res => {
                    // node.error(`Status code: ${res.statusCode}`);
                    // node.error(`Status message: ${res.statusMessage}`);
                    if(res.statusCode!=200)
                        node.status({fill:"red",shape:"dot",text:`${res.statusMessage}, ${res.statusCode}`});
                    else
                    {
                        uploadCount++;
                        node.status({fill:"green",shape:"dot",text:`Total: ${uploadCount}`});
                    }
    
                    res.on('data', d => {
                      process.stdout.write(d)
                    })
                });
            }
            else
            {
                req = https.request(options, res => {
                    // node.error(`Status code: ${res.statusCode}`);
                    // node.error(`Status message: ${res.statusMessage}`);
                    if(res.statusCode!=200)
                        node.status({fill:"red",shape:"dot",text:`${res.statusMessage}, ${res.statusCode}`});
                    else
                    {
                        uploadCount++;
                        node.status({fill:"green",shape:"dot",text:`Total: ${uploadCount}`});
                    }
    
                    res.on('data', d => {
                      process.stdout.write(d)
                    })
                });    
            }

            req.on('error', error => {
                // node.error(error);
                node.status({fill:"red",shape:"dot",text:`${error}`});
                busyFlag = 0;
                return;
            });

            req.write(JSON.stringify(toTrendlog));
            req.end();
            busyFlag = 0;
        }

        /****************************************/
        
        function signalHandler(signal) {
            //Internet is now available, and data can be sent.
            trendlogPostData();
        }
        
        process.on('SIGUSR2', signalHandler);
                

        var uploadCount = 0;
        //On node input       
        node.on('input', function(msg) {    
            
            var time = new Date();
            var value = msg.payload;
            var valid = false;
//            timestamp = `${time.getUTCFullYear()}-${time.getUTCMonth()+1}-${time.getUTCDate()} ${time.getUTCHours()}:${time.getUTCMinutes()}:${time.getUTCSeconds()}`;
            
            // validate value
            if(value!=null)
            {
                if(datalocation_config == "trendlogiolive" && value.hasOwnProperty("data")&&value.data.length > 0&&value.data[0].hasOwnProperty("timestamp"))
                {
                    //convert data to feeds
                    var feeds = [];
                    value["data"].forEach((element, index) => {
                        const newObj = {};
                        Object.entries(element).map(([key, val]) =>
                        {
                            // Modify key here
                            if(key=="timestamp")
                                newObj["timestamp"] = val;
                            else
                            {
                                newObj["name"] = `${deviceID_config}${key}`;
                                newObj["value"] = val;
                            }
                        })
                        feeds.push(newObj);
                    });
                    value = {"feeds": feeds};
                    valid = true;
                }
                else if((datalocation_config == "trendlogiolive" && value.hasOwnProperty("feeds")&&value.feeds.length > 0&&value.feeds[0].hasOwnProperty("timestamp")) ||
                (datalocation_config != "trendlogiolive" && value.hasOwnProperty("data")&&value.data.length > 0&&value.data[0].hasOwnProperty("timestamp")))
                {
                    //insert deviceID
                    if(deviceID_config!="")
                    {
                        if(value.hasOwnProperty("data"))
                        {
                            value["data"].forEach((element, index) => {
                                const newObj = {};
                                Object.entries(element).map(([key, val]) =>
                                {
                                    // Modify key here
                                    if(key!="timestamp")
                                        newObj[`${deviceID_config}${key}`] = val;
                                    else
                                        newObj[key] = val;
                                })
                            value["data"][index] = newObj;
                            });
                        }
                        if(value.hasOwnProperty("feeds"))
                        {
                            value["feeds"].forEach((element, index) => {
                                    element["name"] = `${deviceID_config}${element["name"]}`;
                            value["feeds"][index] = element;
                            });
                        }
                        valid = true;
                    }
                }

                if(valid)
                {
                    node.status({fill:"yellow",shape:"dot",text:`Total: ${uploadCount}`});
                    trendlogPostData(value);    
                }
                else
                {
    //                node.error(`Status code: ${response.statusCode}`);
                    if(datalocation_config == "trendlogiolive")
                    {
                        node.error(`Status message: "Live Data format not valid."`);
                        node.status({fill:"red",shape:"dot",text:`Live Data format not valid`});
                    }
                    else
                    {
                        node.error(`Status message: "Log Data format not valid."`);
                        node.status({fill:"red",shape:"dot",text:`Log Data format not valid`});
                    }
                }

            }
        });

        node.on('close', function() {
            process.off('SIGUSR2', signalHandler);
           
        });
    };
    RED.nodes.registerType("Trendlog", Trendlog);



 /*********** configuration node **************/
    function Trendlogsetup(config) {
        RED.nodes.createNode(this,config);

        // const crypto = require("crypto");
        // const id = crypto.randomBytes(4).toString("hex");

        this.apiKey = config.apiKey;

        //this.deviceID = config.deviceID;
        //this.enableDeviceID = config.enableDeviceID;
        // if(this.deviceID === "")
        //     this.deviceID = config.deviceID = id;

        this.datalocation = config.datalocation;
        this.trendloghost = config.trendloghost;
        this.prefix = config.prefix;
    };

    RED.nodes.registerType("Trendlog-setup", Trendlogsetup);


 /*********** configuration node **************/
    function Trendlogdevice(config) {
        RED.nodes.createNode(this,config);

        // const crypto = require("crypto");
        // const id = crypto.randomBytes(4).toString("hex");

        this.deviceID = config.deviceID;
        this.enableprefix = config.enableprefix;
        // if(this.deviceID === "")
        //     this.deviceID = config.deviceID = id;
    };

RED.nodes.registerType("Device-ID-setup", Trendlogdevice);
};
