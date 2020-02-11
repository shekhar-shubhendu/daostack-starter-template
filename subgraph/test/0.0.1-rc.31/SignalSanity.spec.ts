import {
  getContractAddresses,
  getOptions,
  getWeb3,
  writeProposalIPFS,
  sendQuery
} from './util';

jest.setTimeout(30000);

const SignalScheme = require('./SignalScheme.json')

const maintest = async (web3, opts, proposalIPFSData, matchto) => {

  const signalSchemeMock = new web3.eth.Contract(SignalScheme.abi, opts);
  const signalContract = await signalSchemeMock.deploy({
    data: SignalScheme.bytecode,
    arguments: []
  }).send()
  let descHash = await writeProposalIPFS(proposalIPFSData);
  await signalContract.methods.signal(descHash).send();

  const metaq = `{
      signals{
        id
        data
      }
    }`

  const metadata = await sendQuery(metaq, 15000);
  expect(metadata).toMatchObject(matchto);

}

describe('Generic Signal Scheme', () => {
  let web3;
  let opts;

  beforeAll(async () => {
    web3 = await getWeb3();
    opts = await getOptions(web3);
  });

  it('generic scheme proposal generate ', async () => {

    let proposalIPFSData = {
      description: 'Setting new header Image',
      title: 'New Header Image',
      url: 'https://en.wikipedia.org/wiki/File:A5-1_GSM_cipher.svg',
      key: 'Header',
      value: 'https://en.wikipedia.org/wiki/File:A5-1_GSM_cipher.svg',
    };

    let matchto = {
      signals: [
        {
          data:
            '{"Header":"https://en.wikipedia.org/wiki/File:A5-1_GSM_cipher.svg"}',
          id:
            '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'
        }
      ]
    }

    await maintest(web3, opts, proposalIPFSData, matchto)


  }, 100000);

});