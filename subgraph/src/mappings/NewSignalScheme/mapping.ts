// Import event types from the Reputation contract ABI
import { SignalLog } from '../../types/NewSignalScheme/NewSignalScheme';
  
  import * as domain from '../../domain';

export function handleSignal( event: SignalLog): void {
    var signalId = event.params._sender.toHex();
    var proposalId = event.params._descriptionHash;
    domain.addSignal(signalId, proposalId);
}
