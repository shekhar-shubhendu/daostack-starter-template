import {
    getContractAddresses,
    getOptions,
    getWeb3,
    writeProposalIPFS,
  } from './util';

  jest.setTimeout(30000);
  
  const SignalScheme = require('../../../build/contracts/SignalScheme.json')

  const maintest = async (web3, addresses, opts, proposalIPFSData) => {
  
    const signalSchemeMock = new web3.eth.Contract(
      SignalScheme.abi,
      '0x6ff58D7EeaBBDB4F3029b94859fc6f179E2ef914',
      opts,
    );
  
    let descHash = await writeProposalIPFS(proposalIPFSData);

    console.log(descHash)
    
    const signalData = await signalSchemeMock.methods.signal(descHash).send();
    console.log('SignalTrigger: ', JSON.stringify(signalData))
  
  }
  
  describe('Generic Signal Scheme', () => {
    let web3;
    let addresses;
    let opts;
  
    beforeAll(async () => {
      web3 = await getWeb3();
      addresses = getContractAddresses();
      opts = await getOptions(web3);
    });
  
    it('generic scheme proposal generate ', async () => {
  
      let proposalIPFSData = {
        description: 'Setting new header Image',
        title: 'New Header Image',
        url: 'http://swift.org/modest/',
        key: 'Header',
        value: 'https://de.wikipedia.org/wiki/Wald#/media/Datei:Laurisilva_en_el_Cubo_de_la_Galga.jpg',
      };
  
      let matchto = {
        signals:[
           {
             data:
               '{"Header":"https://de.wikipedia.org/wiki/Wald#/media/Datei:Laurisilva_en_el_Cubo_de_la_Galga.jpg"}',
             id:
               '0x86e9fe552e75e4fc51f46e4efc128628ecd5ada7'
           }
         ]
      }
  
      const test = await maintest(web3, addresses, opts,proposalIPFSData)
  
  
    }, 100000);
  
  });