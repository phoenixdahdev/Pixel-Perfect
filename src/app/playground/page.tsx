import IglooHero from "./igloo-hero/igloo-hero";
import JourneyRoom from "./journey-room/journey-room";

const Page = () => {
  return (
    <>
      <div className="h-screen w-full">
        <JourneyRoom />
      </div>
      <IglooHero />
    </>
  );
};

export default Page;
