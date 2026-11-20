import Portal from './portal';
import {LanguageProvider} from './lib/language';
export const dynamic = 'force-dynamic';
export default function Home() { return <LanguageProvider><Portal/></LanguageProvider>; }
