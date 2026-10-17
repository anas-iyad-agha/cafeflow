import dynamic from "next/dynamic";

const CafeFlowApp = dynamic(() => import("../client/src/App"), {
  ssr: false,
});

export default function CafeFlowPage() {
  return <CafeFlowApp />;
}

export async function getServerSideProps() {
  return { props: {} };
}
