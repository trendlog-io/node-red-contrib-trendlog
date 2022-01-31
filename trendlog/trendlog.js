module.exports = function(RED) {

    function Trendlog(config) {
        RED.nodes.createNode(this,config);
        this.name = config.name;
        this.trendlogsetup = RED.nodes.getNode(config.trendlogsetup);
        var node = this;

        /**Required moduels**/
        const https = require('https');

        /**CONFIG variables**/
        var apiKey_config = this.trendlogsetup.apiKey;
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
            minPostInterval = 5; //sec
        }
        else {
            trendlogHost = host_config;
            trendlogPath = `/V1/channels/update/${apiKey_config}`+(prefix_config!=undefined&&prefix_config!=""?`?prefix=`+prefix_config:``);
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
            
            if(busyFlag != 0 || lastPostTime+(minPostInterval*1000) > Date.now()) {
                return;
            }
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
            var req = https.request(options, res => {
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
            value = msg.payload;
//            timestamp = `${time.getUTCFullYear()}-${time.getUTCMonth()+1}-${time.getUTCDate()} ${time.getUTCHours()}:${time.getUTCMinutes()}:${time.getUTCSeconds()}`;
            
            // validate value
            if((datalocation_config == "trendlogiolive" && value.hasOwnProperty("feeds")&&value.feeds.length > 0&&value.feeds[0].hasOwnProperty("timestamp")) ||
                (datalocation_config != "trendlogiolive" && value.hasOwnProperty("data")&&value.data.length > 0&&value.data[0].hasOwnProperty("timestamp")))
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
        });

        node.on('close', function() {
            process.off('SIGUSR2', signalHandler);
           
        });
    };
    RED.nodes.registerType("Trendlog", Trendlog);



 /*********** configuration node **************/
    function Trendlogsetup(config) {
        RED.nodes.createNode(this,config);
        this.apiKey = config.apiKey;
        this.datalocation = config.datalocation;
        this.trendloghost = config.trendloghost;
        this.prefix = config.prefix;
    };

    RED.nodes.registerType("Trendlog-setup", Trendlogsetup);
};
