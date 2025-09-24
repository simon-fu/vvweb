const path = require('path');
const fs = require('fs');

module.exports = {
	mode   : 'development',
	entry  : './src/index.ts',
	module : {
		rules : [
			{
				test    : /\.ts$/,
				use     : 'ts-loader',
				exclude : /node_modules/
			}
		]
	},
	resolve : {
		extensions : [ '.ts', '.js' ]
	},
	output : {
		filename : 'dist/bundle.js',
		path     : path.resolve(__dirname, 'dist')
	},
	devServer : {
	        server:{
		   type: "https",
		   options: {
                     // key: fs.readFileSync(path.resolve('/usr/local/cert/ttstream.com.key')), // 私钥路径
                     // cert: fs.readFileSync(path.resolve('/usr/local/cert/ttstream.com.pem')), // 证书路径
		     key: fs.readFileSync(path.resolve('/Users/simon/simon/src/vvswitch/vvswitch/test_cfg/tt1.rtcsdk.com.key')),
		     cert: fs.readFileSync(path.resolve('/Users/simon/simon/src/vvswitch/vvswitch/test_cfg/tt1.rtcsdk.com.pem')),
                    }
		},
		allowedHosts: 'all',
		liveReload : false,
		host: '0.0.0.0',
		port       : 443,
		static     : {
			directory: __dirname
		}

	}
};

