/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        return new Promise(async (resolve, reject) => {
            // resolve with block added or reject if error occurred
            try {
                // Check height and set prevHash
                const prevHash = (this.height >= 0) ? 
                    this.chain[this.height].hash :
                    null;
                
                block.previousBlockHash = prevHash;

                // assign timestamp and correct height
                block.time = Date.now().toString().slice(0, -3);
                this.height++;
                block.height = this.height;

                // Create block hash and push block into chain
                block.hash = SHA256(JSON.stringify(block)).toString();
                this.chain.push(block);     
                resolve(block);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            const message = `${address}:${Date.now().toString().slice(0, -3)}:starRegistry`;
            resolve(message);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                // Get time from message
                const time = parseInt(message.split(':')[1]);

                // Get current time
                const currTime = parseInt(Date.now().toString().slice(0, -3));

                // Check if time elapsed less than 5 minutes
                const fiveMins = 300;
                if (currTime - time > fiveMins) {
                    reject('Time elapsed greater than 5 minutes');
                    return;
                }

                // Verify message with wallet address and signature
                if (!bitcoinMessage.verify(message, address, signature)) {
                    reject('Bitcoin message is invalid');
                    return;
                }

                // Create block and add to chain
                const data = {
                    'address':   address,
                    'signature': signature,
                    'message':   message,
                    'star':      star
                };
                let block = new BlockClass.Block({data: data});
                this._addBlock(block);

                // Resolve with block added
                resolve(block);
                
            } catch (err) {
                console.log(err);
                reject(err);
            } 
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let block = this.chain.filter((block) => block.hash === hash)[0];
                resolve(block || null);
            } catch (err) {
                reject(err);
            } 
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let stars = [];
        return new Promise(async (resolve, reject) => {
            try {
                const allData = await Promise.all(this.chain.map((block) => block.getBData()));
                const ownedBlocks = allData.filter((data) => {
                    return data.data.address === address;
                });
                stars = ownedBlocks.map((block) => {
                    return {
                        'owner': block.data.address,
                        'star':  block.data.star
                    };
                });
                resolve(stars);
            } catch (err) {
                reject(err);
            }    
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            try {
                // validate each block using `validate`
                const validated = await Promise.all(this.chain.map((block) => block.validate()));

                // generate list of errors
                for (let index = 0; index < validated.length; index++) {
                    if (!validated[index]) {
                        errorLog.push(`block ${index} is invalid`);
                    }
                }

                resolve(errorLog);
            } catch (err) {
                console.log(err);
                reject(err);
            } 
        });
    }

    /**
      * Utility function to tamper block for testing
    */
    tamperBlock(height) {
        this.chain[height].body = 'induced error';
    }
}

module.exports.Blockchain = Blockchain;   
