// Import event types from the Reputation contract ABI
import { SignalLog } from '../../types/NewSignalScheme/NewSignalScheme'; 
import * as domain from '../../domain';
import * as utils from '../../utils';

export function handleSignal( event: SignalLog): void {
    let signalId = event.params._sender.toHex();
    let proposalId = event.params._descriptionHash;
    utils.debug(proposalId)
    domain.addSignal(signalId, proposalId);
}
