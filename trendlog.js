module.exports = function(RED) {

    function Trendlog(config) {
        RED.nodes.createNode(this,config);
        this.name = config.name;
        this.trendlogsetup = RED.nodes.getNode(config.trendlogsetup);
        var node = this;

        /**Required moduels**/
        const request = require('request');
        

        /**CONFIG variables**/
        var apiKey_config = this.trendlogsetup.apiKey;
        var host_config = this.trendlogsetup.trendloghost;
        var datalocation_config = this.trendlogsetup.datalocation;
        var name_config = this.trendlogsetup.name;
        var prefix_config = this.trendlogsetup.prefix;

        /********************/
       
        /**Trendlog related variables**/
        var trendlogPOSTUrl = `https://api.trendlog.io/V1/channels/update/${apiKey_config}`;
        if(datalocation_config != "trendlogio") {
            trendlogPOSTUrl = host_config + `/${apiKey_config}`+(prefix_config!=undefined&&prefix_config!=""?`?prefix=`+prefix_config:``);
        }
        var timestamp;
        var value;

        console.log(trendlogPOSTUrl);

        /*****************************/
        var busyFlag = 0;
        var maxPostSize = 10;
        
        /**
        * Trendlog related functions
        */
        function trendlogPostData(toTrendlog) {
            
            if(busyFlag != 0) {
                return;
            }
            busyFlag = 1;

            //Setup HTTPS request options.
            var options = {
                url: trendlogPOSTUrl,
                body: toTrendlog,
                json: true,
/*                agentOptions: {
                    ca: ca_certificates
                }
*/            }
           
            //Post toTrendlog             
            request.post(options, function(error, response, body){
                    
                    if(error) {
                        node.error(error);
                        node.status({fill:"red",shape:"dot",text:`${error}`});
                        busyFlag = 0;
                        return;    
                    }    
                    else if(response.statusCode != 200) {
                        node.error(`Status code: ${response.statusCode}`);
                        node.error(`Status message: ${response.statusMessage}`);
                        node.status({fill:"red",shape:"dot",text:`${response.statusMessage}, ${response.statusCode}`});
//                        node.status({fill:"red",shape:"dot",text:`${response.statusMessage}, ${response.statusCode}, Queue: ${sqliteGetAll(tableName).length}`});
                    }
                    else {
//                        setTimeout(trendlogPostData, 1); 
                        uploadCount++;
                        node.status({fill:"green",shape:"dot",text:`Total: ${uploadCount}`});
                    }
                    busyFlag = 0;
            });
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
            timestamp = `${time.getUTCFullYear()}-${time.getUTCMonth()+1}-${time.getUTCDate()} ${time.getUTCHours()}:${time.getUTCMinutes()}:${time.getUTCSeconds()}`;
            
            node.status({fill:"yellow",shape:"dot",text:`Total: ${uploadCount}`});
            trendlogPostData(value);
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

