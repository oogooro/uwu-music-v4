import { InteractionType, MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import { LoggerThread } from 'log4uwu';

interface RunFunctionComponentOptions {
    interaction: MessageComponentInteraction;
    logger: LoggerThread;
}

interface RunFunctionModalOptions {
    interaction: ModalSubmitInteraction;
    logger: LoggerThread;
}

type RunFunctionComponent = (options: RunFunctionComponentOptions) => Promise<any>;
type RunFunctionModal = (options: RunFunctionModalOptions) => Promise<any>;

export type AutomatedInteractionType =
    | { type: InteractionType.MessageComponent, name: string, run: RunFunctionComponent, }
    | { type: InteractionType.ModalSubmit, name: string, run: RunFunctionModal, }